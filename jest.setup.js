import '@testing-library/jest-native/extend-expect';

// Mock expo modules that require native runtime
jest.mock('expo-audio', () => {
  const mockRecorder = {
    id: 'mock-recorder',
    currentTime: 0,
    isRecording: false,
    uri: null,
    prepareToRecordAsync: jest.fn(() => Promise.resolve()),
    record: jest.fn(),
    stop: jest.fn(() => Promise.resolve()),
  };
  return {
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, status: 'granted', canAskAgain: true })),
      getRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, status: 'granted', canAskAgain: true })),
    },
    RecordingPresets: {
      HIGH_QUALITY: {
        extension: '.m4a',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    useAudioRecorder: jest.fn(() => mockRecorder),
    useAudioRecorderState: jest.fn(() => ({
      isRecording: false,
      canRecord: true,
      durationMillis: 0,
      isPrepared: true,
    })),
  };
});

jest.mock('expo-constants', () => ({
  default: {},
  expoConfig: {},
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///documentDirectory/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 77 * 1024 * 1024, uri: 'file:///documentDirectory/models/ggml-tiny.bin' })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documentDirectory/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 77 * 1024 * 1024, uri: 'file:///documentDirectory/models/ggml-tiny.bin' })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn(() => Promise.resolve()),
      localUri: 'file:///documentDirectory/models/ggml-tiny.bin',
      uri: 'file:///documentDirectory/models/ggml-tiny.bin',
    })),
  },
}));

// Inject WhisperModule mock into NativeModules without mocking entire react-native
try {
  const { NativeModules } = require('react-native');
  if (NativeModules && !NativeModules.WhisperModule) {
    NativeModules.WhisperModule = {
      loadModel: jest.fn(() => Promise.resolve({ sizeBytes: 77 * 1024 * 1024 })),
      transcribe: jest.fn(() => Promise.resolve({ text: 'Hoy gasté treinta y cinco bolivianos en almuerzo.', language: 'es', segments: [] })),
      unloadModel: jest.fn(() => Promise.resolve()),
      getMemoryUsage: jest.fn(() => Promise.resolve(120 * 1024 * 1024)),
    };
  }
} catch {}

// react-native-reanimated mock — required for jest without worklets runtime
try {
  require('react-native-reanimated').setUpTests = () => {};
} catch {}
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  return {
    ...actual,
  };
});
