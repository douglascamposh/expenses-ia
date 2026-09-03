import ExpoModulesCore
import AVFoundation

// WhisperModule — iOS Expo Module wrapping C++ WhisperEngine via bridging header
// Decoding: m4a 44.1kHz stereo → PCM 16kHz mono via AVAudioConverter
public class WhisperModule: Module {
  // C++ engine instance (bridged via Objective-C++ wrapper)
  // For Swift, we call through WhisperEngineBridge (ObjC++).
  private var isLoaded = false

  public func definition() -> ModuleDefinition {
    Name("WhisperModule")

    // Load model from absolute file path
    AsyncFunction("loadModel") { (modelPath: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        // Copy Swift string to C++ via bridge
        // WhisperEngineBridge.loadModel is Objective-C++ wrapping WhisperEngine
        let success = WhisperEngineBridge.shared.loadModel(modelPath)
        if success {
          self.isLoaded = true
          // Return sizeBytes
          let size = WhisperEngineBridge.shared.modelSizeBytes()
          promise.resolve(["sizeBytes": size])
        } else {
          promise.reject("MODEL_LOAD_FAILED", "Unable to load speech model")
        }
      }
    }

    AsyncFunction("transcribe") { (filePath: String, options: [String: Any]?, promise: Promise) in
      let language = (options?["language"] as? String) ?? "es"
      let threads = (options?["threads"] as? Int) ?? 4
      let translate = (options?["translate"] as? Bool) ?? false

      // Must not block UI thread
      DispatchQueue.global(qos: .userInitiated).async {
        guard self.isLoaded else {
          promise.reject("MODEL_NOT_READY", "Whisper model not found")
          return
        }

        // 1. Decode m4a file to PCM 16kHz mono
        guard let pcm = self.decodeAudioFileToPcm16kMono(filePath: filePath) else {
          promise.reject("INVALID_AUDIO", "Unable to process audio")
          return
        }

        // 2. Transcribe via C++ engine
        let text = WhisperEngineBridge.shared.transcribePcm(
          pcm, threads: Int32(threads), language: language, translate: translate
        )
        if text.isEmpty && pcm.count > 0 {
          promise.reject("TRANSCRIPTION_FAILED", "Unable to transcribe audio")
          return
        }

        // 3. Memory usage (task_info)
        let memory = self.currentMemoryUsage()

        promise.resolve([
          "text": text,
          "language": language,
          "segments": [] as [[String: Any]],
          "memoryUsageBytes": memory as Any
        ])
      }
    }

    AsyncFunction("unloadModel") { (promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        WhisperEngineBridge.shared.unload()
        self.isLoaded = false
        promise.resolve(nil)
      }
    }

    AsyncFunction("getMemoryUsage") { (promise: Promise) in
      let mem = self.currentMemoryUsage()
      promise.resolve(mem)
    }
  }

  // MARK: - Audio decoding

  private func decodeAudioFileToPcm16kMono(filePath: String) -> [Float]? {
    let url = URL(fileURLWithPath: filePath.replacingOccurrences(of: "file://", with: ""))
    guard let audioFile = try? AVAudioFile(forReading: url) else { return nil }

    let sourceFormat = audioFile.processingFormat
    guard let targetFormat = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: 16000,
      channels: 1,
      interleaved: false
    ) else { return nil }

    guard let converter = AVAudioConverter(from: sourceFormat, to: targetFormat) else { return nil }

    let sourceFrameCount = AVAudioFrameCount(audioFile.length)
    guard let inputBuffer = AVAudioPCMBuffer(
      pcmFormat: sourceFormat,
      frameCapacity: sourceFrameCount
    ) else { return nil }

    do {
      try audioFile.read(into: inputBuffer)
    } catch {
      return nil
    }

    let ratio = targetFormat.sampleRate / sourceFormat.sampleRate
    let targetFrameCapacity = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio) + 1024
    guard let outputBuffer = AVAudioPCMBuffer(
      pcmFormat: targetFormat,
      frameCapacity: targetFrameCapacity
    ) else { return nil }

    var error: NSError?
    let status = converter.convert(to: outputBuffer, error: &error) { _, outStatus in
      outStatus.pointee = .haveData
      return inputBuffer
    }

    guard status != .error, error == nil else { return nil }

    guard let channelData = outputBuffer.floatChannelData?[0] else { return nil }
    let frameLength = Int(outputBuffer.frameLength)
    return Array(UnsafeBufferPointer(start: channelData, count: frameLength))
  }

  private func currentMemoryUsage() -> Int64? {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info>.size) / 4
    let kerr = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    if kerr == KERN_SUCCESS {
      return Int64(info.phys_footprint)
    }
    return nil
  }
}

// ObjC++ bridge declaration (implemented in WhisperEngineBridge.mm)
@objc class WhisperEngineBridge: NSObject {
  @objc static let shared = WhisperEngineBridge()
  @objc func loadModel(_ path: String) -> Bool { return false } // stub, real impl in .mm
  @objc func transcribePcm(_ pcm: [Float], threads: Int32, language: String, translate: Bool) -> String { return "" }
  @objc func unload() {}
  @objc func modelSizeBytes() -> Int64 { return 0 }
}
