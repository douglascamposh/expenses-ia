#include "WhisperEngine.h"
#include "whisper.h"
#include <fstream>
#include <mutex>

WhisperEngine::WhisperEngine() = default;

WhisperEngine::~WhisperEngine() {
  unload();
}

bool WhisperEngine::loadModel(const std::string& modelPath) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (ctx_) {
    whisper_free(ctx_);
    ctx_ = nullptr;
  }
  struct whisper_context_params params = whisper_context_default_params();
  // Enable hardware acceleration if available (CoreML/Metal on iOS, OpenVINO on Android is handled via ggml backend)
  // For POC we keep default; whisper.cpp will auto-select ggml backend.

  ctx_ = whisper_init_from_file_with_params(modelPath.c_str(), params);
  if (!ctx_) return false;

  modelPath_ = modelPath;
  loaded_ = true;

  // Approximate model size via file size
  std::ifstream in(modelPath, std::ios::binary | std::ios::ate);
  if (in) modelSizeBytes_ = static_cast<size_t>(in.tellg());

  return true;
}

bool WhisperEngine::isLoaded() const { return loaded_ && ctx_ != nullptr; }

void WhisperEngine::unload() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (ctx_) {
    whisper_free(ctx_);
    ctx_ = nullptr;
  }
  loaded_ = false;
  modelPath_.clear();
}

size_t WhisperEngine::getModelSizeBytes() const { return modelSizeBytes_; }

std::string WhisperEngine::transcribePcm(const std::vector<float>& pcm, int threads, const std::string& language, bool translate) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!ctx_ || !loaded_) return "";

  struct whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
  wparams.print_progress = false;
  wparams.print_special = false;
  wparams.print_realtime = false;
  wparams.print_timestamps = false;
  wparams.translate = translate;
  wparams.language = language.c_str(); // "es"
  wparams.n_threads = threads > 0 ? threads : 4;
  wparams.offset_ms = 0;
  wparams.no_context = true;
  wparams.single_segment = false;

  // whisper_full runs on background thread (caller ensures not UI thread)
  int ret = whisper_full(ctx_, wparams, pcm.data(), static_cast<int>(pcm.size()));
  if (ret != 0) return "";

  int n_segments = whisper_full_n_segments(ctx_);
  std::string result;
  for (int i = 0; i < n_segments; ++i) {
    const char* text = whisper_full_get_segment_text(ctx_, i);
    if (i > 0) result += " ";
    result += text;
  }
  return result;
}
