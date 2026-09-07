/**
 * Native abstraction — isolates JNI / Objective-C++ / C++ / NDK / Metal / CoreML.
 * UI and services must never import platform-specific details directly.
 */

export type NativeModuleStatus = 'available' | 'unavailable' | 'not_implemented' | 'error';

export type NativeModuleInfo = {
  name: string;
  status: NativeModuleStatus;
  version?: string;
  errorMessage?: string;
};

export type NativeError = {
  code: string;
  message: string;
  nativeStack?: string;
};

export interface NativeModuleBase {
  readonly moduleName: string;
  getStatus(): Promise<NativeModuleInfo>;
  isAvailable(): Promise<boolean>;
}

/**
 * Future native modules — contracts only.
 * Implementations will live under:
 *   android/src/main/java/... / ios/... / cpp/...
 * and be exposed via Expo Modules API or TurboModules.
 */

export interface WhisperNativeModule extends NativeModuleBase {
  transcribe(audioUri: string): Promise<{ text: string; language?: string }>;
  loadModel(modelPath: string): Promise<void>;
  unloadModel(): Promise<void>;
}

export interface LlamaNativeModule extends NativeModuleBase {
  generate(prompt: string): Promise<{ text: string; tokens: number }>;
  loadModel(modelPath: string): Promise<void>;
  unloadModel(): Promise<void>;
}

export interface AudioNativeModule extends NativeModuleBase {
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>; // returns file URI
  getPermissionsStatus(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermissions(): Promise<'granted' | 'denied'>;
}
