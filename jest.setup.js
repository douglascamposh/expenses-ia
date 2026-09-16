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
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, uri: 'file:///cache/test.m4a' })),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, uri: 'file:///cache/test.m4a' })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  documentDirectory: 'file:///documentDirectory/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: jest.fn(() => Promise.resolve()),
      runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
      getFirstAsync: jest.fn(() => Promise.resolve(null)),
      getAllAsync: jest.fn(() => Promise.resolve([])),
      closeAsync: jest.fn(() => Promise.resolve()),
    }),
  ),
  deleteDatabaseAsync: jest.fn(() => Promise.resolve()),
  closeDatabaseAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn((cb: () => void) => {
    try {
      const cleanup = cb();
      return cleanup;
    } catch {
      return undefined;
    }
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// react-native-safe-area-context mock — insets en cero sin provider nativo
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
});

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


// TODO(PUSH-TEMP): mock desactivado temporalmente — expo-notifications desinstalado.
// jest.mock('expo-notifications', () => ({
//   getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
//   requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
//   scheduleNotificationAsync: jest.fn(() => Promise.resolve('test-id')),
//   setNotificationHandler: jest.fn(),
// }));

jest.mock('expo-speech-recognition', () => {
  const listeners = {};
  const api = {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    isRecognitionAvailable: jest.fn(() => true),
    getSupportedLocales: jest.fn(() =>
      Promise.resolve({ locales: ['es-MX', 'en-US'], installedLocales: ['es-MX'] }),
    ),
    supportsOnDeviceRecognition: jest.fn(() => true),
    addListener: jest.fn((event, cb) => {
      listeners[event] = cb;
      return { remove: jest.fn() };
    }),
  };
  return {
    ExpoSpeechRecognitionModule: api,
    useSpeechRecognitionEvent: jest.fn((event, cb) => {
      listeners[event] = cb;
    }),
    __listeners: listeners,
    __api: api,
  };
});

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'es', languageTag: 'es-BO' }]),
}));

