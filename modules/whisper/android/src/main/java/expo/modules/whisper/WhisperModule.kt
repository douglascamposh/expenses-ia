package expo.modules.whisper

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.media.MediaExtractor
import android.media.MediaCodec
import android.media.MediaFormat
import java.nio.ByteBuffer
import java.io.File

class WhisperModule : Module() {
  private var isLoaded = false

  // JNI bridge to C++ WhisperEngine
  external fun nativeLoadModel(modelPath: String): Boolean
  external fun nativeTranscribePcm(pcm: FloatArray, threads: Int, language: String, translate: Boolean): String
  external fun nativeUnloadModel()
  external fun nativeGetModelSizeBytes(): Long

  companion object {
    init {
      try {
        System.loadLibrary("whisper")
        System.loadLibrary("whisper-engine")
      } catch (e: UnsatisfiedLinkError) {
        // Library not yet built — will fail gracefully in JS with MODEL_NOT_FOUND
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WhisperModule")

    AsyncFunction("loadModel") { modelPath: String, promise: Promise ->
      // Run off UI thread
      Thread {
        try {
          val file = File(modelPath.replace("file://", ""))
          if (!file.exists()) {
            promise.reject("MODEL_NOT_FOUND", "Whisper model not found", null)
            return@Thread
          }
          val ok = try { nativeLoadModel(file.absolutePath) } catch (e: UnsatisfiedLinkError) { false }
          if (!ok) {
            promise.reject("MODEL_LOAD_FAILED", "Unable to load speech model", null)
            return@Thread
          }
          isLoaded = true
          val size = try { nativeGetModelSizeBytes() } catch (_: Exception) { file.length() }
          promise.resolve(mapOf("sizeBytes" to size))
        } catch (e: Exception) {
          promise.reject("MODEL_LOAD_FAILED", e.message, e)
        }
      }.start()
    }

    AsyncFunction("transcribe") { filePath: String, options: Map<String, Any>?, promise: Promise ->
      Thread {
        try {
          if (!isLoaded) {
            promise.reject("MODEL_NOT_READY", "Whisper model not found", null)
            return@Thread
          }
          val language = options?.get("language") as? String ?: "es"
          val threads = (options?.get("threads") as? Number)?.toInt() ?: 4
          val translate = options?.get("translate") as? Boolean ?: false

          // 1. Decode m4a/aac → PCM 16kHz mono
          val pcm = decodeAudioToPcm16kMono(filePath)
            ?: run {
              promise.reject("INVALID_AUDIO", "Unable to process audio", null)
              return@Thread
            }

          // 2. Transcribe via JNI (C++ WhisperEngine)
          val text = try {
            nativeTranscribePcm(pcm, threads, language, translate)
          } catch (e: UnsatisfiedLinkError) {
            // Graceful fallback for dev without NDK build
            promise.reject("TRANSCRIPTION_FAILED", "Native whisper library not built", e)
            return@Thread
          }

          if (text.isEmpty() && pcm.isNotEmpty()) {
            promise.reject("TRANSCRIPTION_FAILED", "Unable to transcribe audio", null)
            return@Thread
          }

          val memory = getMemoryUsage()
          promise.resolve(mapOf(
            "text" to text,
            "language" to language,
            "segments" to emptyList<Map<String, Any>>(),
            "memoryUsageBytes" to memory
          ))
        } catch (e: Exception) {
          promise.reject("TRANSCRIPTION_FAILED", e.message, e)
        }
      }.start()
    }

    AsyncFunction("unloadModel") { promise: Promise ->
      Thread {
        try { nativeUnloadModel() } catch (_: Exception) {}
        isLoaded = false
        promise.resolve(null)
      }.start()
    }

    AsyncFunction("getMemoryUsage") { promise: Promise ->
      promise.resolve(getMemoryUsage())
    }
  }

  private fun getMemoryUsage(): Long? {
    return try {
      val info = android.os.Debug.MemoryInfo()
      android.os.Debug.getMemoryInfo(info)
      info.totalPss.toLong() * 1024 // KB → bytes
    } catch (_: Exception) { null }
  }

  /**
   * Decode audio file (m4a/AAC) to Float32 PCM 16kHz mono.
   * Uses MediaExtractor + MediaCodec; resampling via simple linear interpolation if needed.
   */
  private fun decodeAudioToPcm16kMono(filePath: String): FloatArray? {
    val path = filePath.replace("file://", "")
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(path)
      if (extractor.trackCount == 0) return null
      var trackIndex = -1
      var format: MediaFormat? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          trackIndex = i
          format = f
          break
        }
      }
      if (trackIndex == -1 || format == null) return null
      extractor.selectTrack(trackIndex)
      val mime = format.getString(MediaFormat.KEY_MIME)!!
      val codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val pcmChunks = mutableListOf<Short>()
      val bufferInfo = MediaCodec.BufferInfo()
      var isEOS = false
      val timeoutUs = 10000L

      while (!isEOS) {
        if (!isEOS) {
          val inputIndex = codec.dequeueInputBuffer(timeoutUs)
          if (inputIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inputIndex)!!
            val sampleSize = extractor.readSampleData(inputBuffer, 0)
            if (sampleSize < 0) {
              codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              isEOS = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outputIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
        if (outputIndex >= 0) {
          val outputBuffer: ByteBuffer = codec.getOutputBuffer(outputIndex)!!
          if (bufferInfo.size > 0) {
            val shorts = ShortArray(bufferInfo.size / 2)
            outputBuffer.asShortBuffer().get(shorts)
            for (s in shorts) pcmChunks.add(s)
          }
          codec.releaseOutputBuffer(outputIndex, false)
          if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break
        } else if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          // format changed
        }
      }
      codec.stop()
      codec.release()
      extractor.release()

      if (pcmChunks.isEmpty()) return null

      // Convert Short (16-bit) → Float32 mono, resample to 16kHz if needed
      val sourceSampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
      val channelCount = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2

      // De-interleave stereo → mono (average)
      val monoShorts: ShortArray = if (channelCount == 2) {
        val mono = ShortArray(pcmChunks.size / 2)
        for (i in mono.indices) {
          val left = pcmChunks[i * 2].toInt()
          val right = pcmChunks[i * 2 + 1].toInt()
          mono[i] = ((left + right) / 2).toShort()
        }
        mono
      } else {
        pcmChunks.toShortArray()
      }

      // Short → Float [-1,1]
      val floatMono = FloatArray(monoShorts.size) { monoShorts[it] / 32768f }

      // Resample to 16kHz if needed (simple linear)
      if (sourceSampleRate == 16000) return floatMono
      return resampleLinear(floatMono, sourceSampleRate, 16000)
    } catch (e: Exception) {
      try { extractor.release() } catch (_: Exception) {}
      return null
    }
  }

  private fun resampleLinear(input: FloatArray, srcRate: Int, dstRate: Int): FloatArray {
    if (srcRate == dstRate) return input
    val ratio = srcRate.toDouble() / dstRate.toDouble()
    val newSize = (input.size / ratio).toInt()
    val output = FloatArray(newSize)
    for (i in output.indices) {
      val pos = i * ratio
      val idx = pos.toInt()
      val frac = (pos - idx).toFloat()
      val s1 = input[idx]
      val s2 = if (idx + 1 < input.size) input[idx + 1] else s1
      output[i] = s1 * (1 - frac) + s2 * frac
    }
    return output
  }
}
