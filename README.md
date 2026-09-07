# Local AI Expense Assistant — Audio Recording (Feature 2)

Offline-first React Native expense assistant. Por ahora **solo grabación de audio local**: `Microphone → Temporary File (cache .m4a)` listo para enviar a **API cloud** para STT. IA local `whisper.cpp` descartada.

## Current POC

```
React Native (Expo SDK 57, New Architecture, Hermes)
      ↓
Local AI Test Screen (src/screens/LocalAITestScreen)
      ↓
useAudioRecording (AudioRecordingResult) → expo-audio → Temporary File (cache .m4a)
      ↓ filePath (m4a 44.1kHz stereo, listo para API)
Future: API STT → LLM → JSON → Validation
```

**Local AI Test ahora:**

```
Local AI Test — Runtime Offline (badge)

AI Pipeline
 [ Audio ]      Ready
    ↓
 [ Whisper ]    API (cloud) — pending
    ↓
 [ Local LLM ]  Not implemented
    ...

Audio
 Status: Ready | Recording | Processing | Error
 [ Start Recording ] → [ Stop Recording ]
 Audio ready — listo para enviar a API
 Duration: 3.2s
 Format: m4a • audio/m4a
 file:///cache/...m4a
```

Grabación real en dispositivo/emulador, mockeada en tests. Un solo botón (grabar/parar).

## Architecture

```
src/
 ├── audio/  — expo-audio wrapper (AUDIO_CONFIG, permisos, filePath)
 │   ├── expo-audio.recorder.ts
 │   └── types (AudioRecordingResult, AudioRecorder)
 ├── hooks/use-audio-recording.ts — estado idle/requesting_permission/recording/processing/error
 ├── screens/LocalAITestScreen — UI 1 botón + pipeline
 ├── ai/ — mocks (MockSpeechToTextEngine not_implemented, futura API)
 └── native/ — abstracción (no whisper)
```

- `LocalAITestScreen` solo importa `useAudioRecording`.
- `filePath` se pasará a API: `fetch(API_URL, { filePath })` o multipart, sin Base64 innecesario si API acepta file.
- Sin `any`, TS strict.

## Audio Configuration

```
Container: m4a, Codec: aac, SampleRate: 44100, Channels: 2, BitRate: 128000, MIME: audio/m4a
Preset: RecordingPresets.HIGH_QUALITY (expo-audio)
```

Compatible iOS/Android, sin fricción. Para API, se enviará tal cual o se convertirá server-side a 16kHz mono si requerido.

## Tech Stack

- Expo SDK 57.0.20, RN 0.86.3, React 19.2.3, TS 6.0.3
- expo-audio 57.0.4, expo-asset, expo-router, reanimated
- Node 24.20.0 (engines >=22.13.0)

Install & run:
```bash
npm install
npx expo start          # web / Expo Go (audio en web limitado, usar device)
npx expo run:android    # emulador/físico (requiere prebuild si nativo)
```

Quality:
```bash
npm run typecheck
npm run lint
npm test          # 5 suites 36 tests
npx expo-doctor   # 21/21 PASS
```

## Pipeline

```
Audio File (cache .m4a, filePath)
      ↓ (via API)
STT API (cloud)
      ↓ text
LLM → ExpenseCommand
```

Audio `filePath` de `AudioRecordingResult` se enviará a API. Por ahora solo se muestra en UI; próximo paso implementar `fetch` a endpoint STT.

## Known Limitations

- Solo grabación, sin transcripción aún (API pendiente).
- `HIGH_QUALITY` 44.1kHz stereo; API puede requerir transcode server-side.
- Background recording deshabilitado.
- Tests mockean mic; validación real requiere device + permisos.

## Next

Implementar `Audio → API STT` (cloud) y luego `LLM → JSON`.

## History

- Feature 3/4 whisper.cpp local implementado y luego descartado por decisión de usar API cloud para STT. Código whisper eliminado (modules/whisper, ModelManager, etc.).
