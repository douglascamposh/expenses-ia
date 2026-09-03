#pragma once
#include <string>
#include <vector>
#include <mutex>

struct whisper_context;

/**
 * WhisperEngine — thin C++ wrapper isolating whisper.cpp API.
 * Shared between iOS and Android. Handles:
 * - load model
 * - transcribe PCM 16kHz mono
 * - free resources
 * Thread-safe: one transcription at a time via mutex.
 */
class WhisperEngine {
public:
  WhisperEngine();
  ~WhisperEngine();

  // Load model from file path. Returns true on success.
  bool loadModel(const std::string& modelPath);

  // Transcribe PCM float32 mono 16kHz.
  // Returns text; empty on failure.
  std::string transcribePcm(const std::vector<float>& pcm, int threads, const std::string& language, bool translate);

  // Convenience: decode file path -> PCM via native decoder (implemented per-platform)
  // This stub expects already decoded PCM; decoding is done in platform layer.
  bool isLoaded() const;
  void unload();
  size_t getModelSizeBytes() const;

private:
  whisper_context* ctx_ = nullptr;
  std::string modelPath_;
  size_t modelSizeBytes_ = 0;
  std::mutex mutex_;
  bool loaded_ = false;
};
