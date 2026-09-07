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
