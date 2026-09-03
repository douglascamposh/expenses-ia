#include <jni.h>
#include <string>
#include <vector>
#include "WhisperEngine.h"

static WhisperEngine g_engine;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_expo_modules_whisper_WhisperModule_nativeLoadModel(JNIEnv* env, jobject /* this */, jstring jPath) {
  const char* path = env->GetStringUTFChars(jPath, nullptr);
  bool ok = g_engine.loadModel(std::string(path));
  env->ReleaseStringUTFChars(jPath, path);
  return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jstring JNICALL
Java_expo_modules_whisper_WhisperModule_nativeTranscribePcm(JNIEnv* env, jobject /* this */, jfloatArray jPcm, jint threads, jstring jLang, jboolean jTranslate) {
  jsize len = env->GetArrayLength(jPcm);
  jfloat* data = env->GetFloatArrayElements(jPcm, nullptr);
  std::vector<float> pcm(data, data + len);
  env->ReleaseFloatArrayElements(jPcm, data, JNI_ABORT);

  const char* lang = env->GetStringUTFChars(jLang, nullptr);
  std::string langStr(lang);
  env->ReleaseStringUTFChars(jLang, lang);

  std::string result = g_engine.transcribePcm(pcm, (int)threads, langStr, jTranslate == JNI_TRUE);
  return env->NewStringUTF(result.c_str());
}

JNIEXPORT void JNICALL
Java_expo_modules_whisper_WhisperModule_nativeUnloadModel(JNIEnv* /* env */, jobject /* this */) {
  g_engine.unload();
}

JNIEXPORT jlong JNICALL
Java_expo_modules_whisper_WhisperModule_nativeGetModelSizeBytes(JNIEnv* /* env */, jobject /* this */) {
  return (jlong)g_engine.getModelSizeBytes();
}

} // extern "C"
