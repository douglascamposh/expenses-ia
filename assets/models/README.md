# Whisper Models (bundled)

Para POC el modelo `tiny` (≈75MB) se empaqueta dentro del bundle.

**Opción recomendada (actual):**

Colocar manualmente para desarrollo:

```bash
./scripts/setup-whisper-model.sh
# o manualmente:
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin -o assets/models/ggml-tiny.bin
```

Luego `ModelManager` copiará `assets/models/ggml-tiny.bin` → `FileSystem.documentDirectory + 'models/ggml-tiny.bin'` en el primer inicio (asset bundle).

**Alternativa tiny-q5_0 (≈40MB, más ligero, peor en números):**
```bash
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_0.bin -o assets/models/ggml-tiny.bin
```

**Importante:** Nunca descargar en runtime. El build debe funcionar en modo avión.
`ModelManager` nunca hace fetch. Si el archivo no existe, lanza `Whisper model not found`.

Placeholder: este repo ignora `*.bin` via `.gitignore` para no bloat. Documentar tamaño en `docs/whisper-model.md`.
