#!/bin/bash
set -e
# Setup whisper tiny model for POC (offline bundling)
# Usage: ./scripts/setup-whisper-model.sh [--tiny-q5]

MODEL_DIR="assets/models"
MODEL_FILE="ggml-tiny.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"

if [[ "$1" == "--tiny-q5" ]]; then
  MODEL_FILE="ggml-tiny-q5_0.bin"
  MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_0.bin"
  echo "Using tiny-q5_0 (≈40MB, lighter, slightly worse Spanish numbers)"
fi

mkdir -p "$MODEL_DIR"

if [[ -f "$MODEL_DIR/$MODEL_FILE" ]]; then
  SIZE=$(du -h "$MODEL_DIR/$MODEL_FILE" | cut -f1)
  echo "✓ Model already exists: $MODEL_DIR/$MODEL_FILE ($SIZE)"
  echo "  To re-download, remove it first: rm $MODEL_DIR/$MODEL_FILE"
  exit 0
fi

echo "Downloading Whisper tiny model (~75MB)..."
echo "URL: $MODEL_URL"
echo "Dest: $MODEL_DIR/$MODEL_FILE"

if command -v curl &> /dev/null; then
  curl -L --progress-bar "$MODEL_URL" -o "$MODEL_DIR/$MODEL_FILE"
elif command -v wget &> /dev/null; then
  wget "$MODEL_URL" -O "$MODEL_DIR/$MODEL_FILE"
else
  echo "Error: need curl or wget"
  exit 1
fi

SIZE=$(du -h "$MODEL_DIR/$MODEL_FILE" | cut -f1)
echo "✓ Downloaded: $MODEL_DIR/$MODEL_FILE ($SIZE)"
echo ""
echo "Next: rebuild app (npx expo prebuild && npx expo run:android)"
echo "The model will be bundled and copied to FileSystem.documentDirectory on first launch."
