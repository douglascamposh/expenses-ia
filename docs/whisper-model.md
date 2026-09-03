# Whisper Model — Feature 3

## Baseline Selection: Tiny

| Modelo | Archivo | Tamaño | RAM aprox | RTF (móvil mid) | Español | Decisión |
|--------|---------|--------|-----------|----------------|---------|----------|
| **tiny** | `ggml-tiny.bin` | **77 MB** | ~200-300 MB | 0.3-0.8x | Bueno suficiente | **Baseline POC** |
| base | `ggml-base.bin` | 142 MB | ~400-500 MB | 1.2-2.0x | Mejor números | Alternativa si hay RAM |
| tiny-q5_0 | `ggml-tiny-q5_0.bin` | ~40 MB | ~150 MB | 0.4-0.9x | Peor números | Opción ligera con tradeoff |

**Criterio POC:** `Good enough Spanish accuracy + Low memory + Latencia aceptable > máxima precisión`. Tiny prioriza tamaño app y memoria; `base` queda como `WhisperModel.BASE` sin tocar UI.

**Source:** https://huggingface.co/ggerganov/whisper.cpp  
**Versión whisper.cpp:** `v1.7.4` (pinneada en `vendor/whisper.cpp` submodule)

## Packaging — Bundled, Offline, No Download

- **No descarga en runtime.** `ModelManager.getModelPath()` nunca hace `fetch`. Si el archivo no existe lanza `Whisper model not found` (código `MODEL_NOT_FOUND`).
- **Bundle:** `assets/models/ggml-tiny.bin` → `expo-asset` + `metro.config.js` (`assetExts: ['bin']`) → copiado a `FileSystem.documentDirectory + 'models/ggml-tiny.bin'` en primer inicio vía `WhisperModelManager`.
- **Provisionamiento manual (dev):**
  ```bash
  ./scripts/setup-whisper-model.sh          # tiny ~77MB
  ./scripts/setup-whisper-model.sh --tiny-q5 # tiny-q5_0 ~40MB
  ```
- **.gitignore:** `*.bin` y `vendor/whisper.cpp/` no se commitean por tamaño.

## Path Abstraction

```
ModelManager (src/ai/model/ModelManager.ts)
  ↓ getModelPath(): Promise<string>  // file:// absolute, no Base64
NativeWhisperModule.loadModel(modelPath)
  ↓
C++ WhisperEngine::loadModel(path)
```

`WhisperModel.TINY / BASE` es única fuente de verdad; cambiar modelo no toca UI (`SpeechToTextService` + `useSpeechToText`).

## Runtime & Aceleración

- **CPU por defecto** (GGML). Correctness primero.
- **iOS:** CoreML/Metal disponible en whisper.cpp; habilitable vía `whisper_context_params.use_gpu` / `enable_coreml` si se compila con `WHISPER_COREML=1`. POC mantiene `false` para estabilidad; documentar si se habilita.
- **Android:** GGML con `NEON`/`OpenVINO` según NDK; POC usa `arm64-v8a` solo (`abiFilters`) para reducir AAB.
- **Threads:** `threads = 4` (configurable `SpeechToTextConfig.threads`).

## Audio Pipeline

```
Recorded File (m4a AAC 44.1kHz stereo, expo-audio HIGH_QUALITY)
  ↓ filePath (no Base64)
Native Decoder:
  Android: MediaExtractor + MediaCodec (AAC→PCM) → de-interleave stereo→mono → resample linear 16kHz
  iOS: AVAudioFile → AVAudioConverter (44.1k→16k, stereo→mono) → Float32
  ↓ Float32 16kHz mono
whisper.cpp whisper_full()
  ↓
TranscriptionResult { text, language, segments }
```

**Por qué:** whisper.cpp exige `16kHz mono Float32`. No se hace en JS para evitar copias/overhead del bridge.

## Métricas

- `audioDurationMs` (de `AudioRecordingResult.durationMs`)
- `transcriptionDurationMs` (Date.now delta en `WhisperCppEngine.transcribe`)
- `RTF = transcriptionDuration / audioDuration` (ej 2000ms/5000ms = 0.40x)
- `modelSizeBytes` (via `FileSystem.getInfoAsync`)
- `memoryUsageBytes` (iOS `task_info phys_footprint`, Android `Debug.getMemoryInfo().totalPss*1024`; si no fiable → `unavailable`)

Todas locales, sin analytics remoto.

## Offline Verification

```
1. Instalar app (modelo ya copiado)
2. Activar Modo Avión
3. Grabar → Stop → transcribe(filePath) → muestra texto
```

Sin `fetch`/`axios`. Verificación: `grep -R fetch src` solo en comentarios.

## Limitaciones

- Modelo no incluido en repo por tamaño; requiere `setup-whisper-model.sh` antes de build.
- Memoria: tiny ~200-300MB peak; low-end <2GB RAM puede OOM (manejo `OUT_OF_MEMORY`).
- Idioma fijo `es`, `translate=false` (es→es). Cambiar requiere `SpeechToTextConfig.language`.
- Una transcripción a la vez (mutex nativo + guard JS).
- Web no soportado (`unavailable`).
- Solo `arm64-v8a` en POC; `armeabi-v7a` omitido para tamaño.

## Próximo Feature

```
TranscriptionResult
  ↓
Local LLM / llama.cpp
  ↓
Structured JSON ExpenseCommand
```
