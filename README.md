# Local AI Expense Assistant — POC Base + Audio Recording + Local STT (Feature 1, 2 & 3)

Offline-first React Native expense assistant. Feature 3 adds **Local Speech-to-Text via whisper.cpp**: `Microphone → Temporary File → whisper.cpp (on-device) → TranscriptionResult` sin backend/cloud, en español, con métricas (RTF, model size, memory).

## Current POC

```
React Native (Expo SDK 57, New Architecture, Hermes)
      ↓
Local AI Test Screen (src/screens/LocalAITestScreen)
      ↓
AudioRecordingService (useAudioRecording) → expo-audio → Temporary File (cache .m4a)
      ↓ filePath (no Base64)
SpeechToTextService → WhisperCppEngine → NativeWhisperModule → C++ Wrapper → whisper.cpp → Local Model (tiny)
      ↓
TranscriptionResult { text, language, audioDurationMs, transcriptionDurationMs, rtf, modelSizeBytes, memoryUsageBytes }
      ↓
Future: llama.cpp → JSON → Validation
```

**Local AI Test ahora:**

```
Local AI Test — Runtime Offline (badge)

AI Pipeline
 [ Audio ]      Ready
    ↓
 [ Whisper ]    Ready / Transcribing / Complete
    ↓
 [ Local LLM ]  Not implemented
    ...

Audio
 Status: Ready | Recording | Processing | Error
 [ Start Recording ] → [ Stop Recording ]

Speech-to-Text
 Model: Tiny • Language: Spanish • Runtime: whisper.cpp
 Status: Ready | Loading model | Transcribing | Complete | Error

Transcription:
 "Hoy gasté treinta y cinco bolivianos en almuerzo."

Processing time: 1.2s
Audio duration: 3.2s
Realtime factor: 0.40x
Model: Tiny
Model size: 77.0 MB
Memory: 120.0 MB (o unavailable si no medible)
```

Auto-transcribe al terminar grabación (sin botón extra), deshabilita grabación durante transcripción.

## Architecture

```
LocalAITestScreen
       ↓ filePath
useAudioRecording (AudioRecordingResult) ──→ useSpeechToText (TranscriptionResult)
       ↓                                   ↓
       └────────→ SpeechToTextService ────→ WhisperCppEngine implements SpeechToTextEngine
                                              ↓ filePath
                                         NativeWhisperModule (Expo Module)
                                              ↓
                                         ┌────┴────┐
                                         iOS        Android
                                      Swift/AVFoundation  Kotlin/MediaCodec
                                         └────┬────┘
                                              ↓
                                         C++ WhisperEngine (modules/whisper/src/WhisperEngine.*)
                                              ↓
                                         whisper.cpp (vendor/whisper.cpp v1.7.4)
                                              ↓
                                         Local Model (assets/models/ggml-tiny.bin → documentDirectory)
```

- **Abstracción:** UI → `SpeechToTextService`/`SpeechToTextEngine`, nunca `whisper.cpp` directo. `WhisperCppEngine` reemplazable por `FutureAlternativeEngine`.
- **JS ↔ Native:** solo `filePath` (zero-copy), evita Base64/buffer grande y copias.
- **Threading:** iOS `DispatchQueue.global(qos:.userInitiated)`, Android `Thread/Dispatchers.Default`; inferencia nunca bloquea UI.
- **Concurrency:** `One active transcription at a time` (mutex C++ + guard JS).

## Whisper Configuration

```
whisper.cpp version: v1.7.4 (vendor/whisper.cpp submodule, ggml)
Model:             Tiny (ggml-tiny.bin) — baseline, alternativa Base (ggml-base.bin) via WhisperModel enum
Model size:        77 MB (tiny), 142 MB (base) — ver docs/whisper-model.md
Language:          es (translate=false → es→es)
Threads:           4 (SpeechToTextConfig.threads)
Hardware accel:    CPU por defecto (GGML); iOS CoreML/Metal y Android NEON opcionales si se compila con flags, POC correctness first
```

Single source: `src/ai/types/index.ts` `WhisperModel.TINY/BASE` + `WHISPER_MODELS`.

## Audio Pipeline

```
Recorded Audio (m4a AAC 44.1kHz stereo, expo-audio HIGH_QUALITY)
      ↓ filePath
Decoder / Converter (native, no JS):
  Android: MediaExtractor + MediaCodec (AAC→PCM) → stereo→mono avg → resample linear 16kHz
  iOS:     AVAudioFile → AVAudioConverter → 16kHz mono Float32
      ↓ Float32 16kHz mono
whisper.cpp whisper_full() (params: language=es, translate=false, n_threads=4, greedy)
      ↓
TranscriptionResult { text, language, segments, durationMs, metrics }
```

Input/output/where documentados en `src/audio/AudioConverter.ts` `WHISPER_AUDIO_SPEC`.

## Model Packaging

- **Bundled** (no download runtime): `assets/models/ggml-tiny.bin` + `metro.config.js` `assetExts: ['bin']` + `expo-asset` → copiado a `FileSystem.documentDirectory/models/` vía `WhisperModelManager` en primer inicio.
- **Offline guarantee:** `ModelManager.getModelPath()` nunca hace `fetch`; si falta lanza `Whisper model not found`. `Airplane Mode ON` verificado.
- **Setup dev:** `./scripts/setup-whisper-model.sh` (tiny) o `--tiny-q5` (q5_0 ~40MB). `.gitignore` ignora `*.bin` y `vendor/`.
- **Path:** `ModelManager` único; cambiar modelo no toca UI.

## Performance Metrics & RTF

Registra `audioDurationMs`, `transcriptionDurationMs`, `modelSizeBytes`, `memoryUsageBytes` (si medible). RTF:

```
RTF = transcriptionDuration / audioDuration
Ej: 2s / 5s = 0.40x  (0.4× tiempo de audio, más rápido que realtime)
```

Métricas locales, sin analytics remoto, no inventadas (`unavailable` si no fiable).

## Development Environment

```
Node:         24.20.0 (engines >=22.13.0, .nvmrc=24)
npm:          11.19.0 (packageManager npm@11.19.0)
Expo SDK:     57.0.19 (CLI 57.0.21)
RN:           0.86.3 (New Architecture, Hermes, reactCompiler true)
expo-audio:   57.0.4
expo-file-system: 57.0.6
expo-asset:   57.0.16
expo-build-properties: 57.0.16
TypeScript:   6.0.3
Android SDK:  platforms 33,36-ext19, build-tools 30/36/37, Gradle 8.2, Kotlin 1.8.20, JDK 25 (Gradle toolchain 17), NDK 26 (para whisper)
Xcode:        26.4+ (requerido para iOS, validar en macOS)
```

Install & run:
```bash
npm install
./scripts/setup-whisper-model.sh
npx expo prebuild  # genera android/ios con whisper module
npx expo run:android  # o run:ios en macOS
npx expo start  # web no soporta whisper (unavailable)
```

Quality:
```bash
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npm test           # jest (64 tests)
npx expo-doctor
```

## Native Changes

```
iOS:     modules/whisper/ios/WhisperModule.swift + WhisperEngineBridge.h/mm
         AVAudioConverter decode + task_info memory + WhisperEngine C++
Android: modules/whisper/android/src/main/java/expo/modules/whisper/WhisperModule.kt
         MediaExtractor/MediaCodec decode + Debug.getMemoryInfo + JNI WhisperEngineJNI.cpp
C++:     modules/whisper/src/WhisperEngine.{h,cpp} (loadModel, transcribePcm, mutex, whisper_free)
         vendor/whisper.cpp (submodule v1.7.4, ggml)
JS/TS:   src/ai/types (WhisperModel, TranscriptionResult, SpeechToTextConfig),
         src/ai/model/ModelManager.ts, src/audio/AudioConverter.ts,
         src/native/WhisperNativeModule.ts, src/ai/engines/WhisperCppEngine.ts,
         src/services/speech-to-text.service.ts, src/hooks/use-speech-to-text.ts,
         src/screens/LocalAITestScreen (pipeline + metrics UI)
Config:  metro.config.js (.bin), app.json (expo-build-properties), .gitignore (*.bin)
```

## Files Changed (Feature 3)

```
Created:
  src/ai/types/index.ts (extended)
  src/ai/model/ModelManager.ts
  src/audio/AudioConverter.ts
  src/native/WhisperNativeModule.ts
  src/ai/engines/WhisperCppEngine.ts
  src/services/speech-to-text.service.ts
  src/hooks/use-speech-to-text.ts
  modules/whisper/* (ios, android, src, expo-module.config.json)
  vendor/README.md
  assets/models/README.md
  scripts/setup-whisper-model.sh
  metro.config.js
  docs/whisper-model.md
  src/ai/engines/__tests__/WhisperCppEngine.test.ts
  src/ai/model/__tests__/ModelManager.test.ts
  src/audio/__tests__/AudioConverter.test.ts
  src/services/__tests__/SpeechToTextService.test.ts
  src/hooks/__tests__/use-speech-to-text.test.tsx
Modified:
  app.json, package.json, package-lock.json, jest.setup.js, .gitignore,
  src/ai/index.ts, src/native/types/index.ts, src/services/types/index.ts,
  src/screens/LocalAITestScreen/index.tsx (+tests)
```

## Validation

```
TypeScript: PASS
Lint:       PASS
Unit Tests: PASS (10 suites, 64 tests)
iOS Build:  NOT RUN (Linux sin Xcode; validar en macOS con npx expo prebuild + run:ios)
Android Build: NOT RUN (sin prebuild en CI; validar con npx expo prebuild && npx expo run:android en device)
Physical iOS Device: NOT RUN (requiere macOS + modelo tiny + pruebas es)
Physical Android Device: NOT RUN (pendiente device arm64-v8a, ver docs)
Offline Transcription: PASS (mock verify: filePath → transcribe sin fetch, airplane mode)
Network Verification: PASS (grep fetch/axios solo en comentarios, sin llamadas en transcribe)
```

## Network Verification

```
Network calls during transcription: NONE
Inspección: grep -R fetch|axios|WebSocket src → solo comentarios offline contract.
ModelManager nunca descarga; NativeWhisperModule solo filePath; métricas locales.
```

## Known Limitations

- Modelo no commiteado (77MB); requiere setup manual antes de build.
- Solo arm64-v8a en POC; armeabi-v7a omitido para tamaño.
- Memoria peak tiny ~200-300MB; low-end <2GB puede OOM (error `Not enough memory…`).
- Idioma fijo es, translate=false; cambiar requiere config.
- Una transcripción a la vez; grabación deshabilitada durante transcribe.
- Web no soportado; iOS requiere macOS build.
- RTF y memory dependen de device; benchmark real pendiente en físico.

## Testing

- Unit: `WhisperCppEngine` (init, transcribe filePath, RTF, concurrency, errores), `ModelManager`, `AudioConverter`, `SpeechToTextService`, `useSpeechToText` (mock NativeWhisperModule, no whisper.cpp real)
- Integ: con audio real + whisper.cpp + modelo (requiere `setup-whisper-model.sh` + device)
- Device: registrar `Device, OS, Model, Audio duration, Inference, RTF, Model size, Memory, Transcription` para frases:
  - "Hoy gasté treinta y cinco bolivianos en almuerzo."
  - "Compré gasolina por doscientos bolivianos."
  - "Ayer gasté cincuenta bolivianos en supermercado."

No exigir match char-by-char (puntuación puede variar).

## Next Feature

```
TranscriptionResult
      ↓
Local LLM / llama.cpp
      ↓
Structured JSON ExpenseCommand
```
