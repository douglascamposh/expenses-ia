import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ExpoAudio from 'expo-audio';

import { useAudioRecording } from '../use-audio-recording';

const mockedUseAudioRecorder = ExpoAudio.useAudioRecorder as unknown as jest.Mock;
const mockedUseAudioRecorderState = ExpoAudio.useAudioRecorderState as unknown as jest.Mock;
const mockedAudioModule = ExpoAudio.AudioModule as unknown as {
  requestRecordingPermissionsAsync: jest.Mock;
  getRecordingPermissionsAsync: jest.Mock;
};
const mockedSetAudioMode = ExpoAudio.setAudioModeAsync as unknown as jest.Mock;

const mockRecorder = {
  id: 'test-recorder',
  currentTime: 2.5,
  isRecording: false,
  uri: 'file:///cache/test.m4a' as string | null,
  prepareToRecordAsync: jest.fn(() => Promise.resolve()),
  record: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
} as unknown as {
  id: string;
  currentTime: number;
  isRecording: boolean;
  uri: string | null;
  prepareToRecordAsync: jest.Mock;
  record: jest.Mock;
  stop: jest.Mock;
};

describe('useAudioRecording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAudioRecorder.mockReturnValue(mockRecorder);
    mockedUseAudioRecorderState.mockReturnValue({ isRecording: false, canRecord: true, durationMillis: 2500 });
    mockedAudioModule.getRecordingPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mockedAudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mockedSetAudioMode.mockResolvedValue(undefined);
    mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
    mockRecorder.record.mockReset();
    mockRecorder.stop.mockResolvedValue(undefined);
    mockRecorder.isRecording = false;
    mockRecorder.uri = 'file:///cache/test.m4a';
    mockRecorder.currentTime = 2.5;
  });

  it('initial state is idle', () => {
    const { result } = renderHook(() => useAudioRecording());
    expect(result.current.state).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('transitions to recording on successful start', async () => {
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('recording'));
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecorder.record).toHaveBeenCalled();
  });

  it('handles permission denied', async () => {
    mockedAudioModule.getRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: true });
    mockedAudioModule.requestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: true });
    mockedAudioModule.getRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false });
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.errorMessage).toMatch(/permission/i);
  });

  it('transitions to processing then idle with result on stop', async () => {
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('recording'));
    mockRecorder.isRecording = true;
    await act(async () => {
      await result.current.stopRecording();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result?.filePath).toBe('file:///cache/test.m4a');
    expect(result.current.result?.format).toBe('m4a');
    expect(result.current.state).toBe('idle');
  });

  it('handles error on start recording failure', async () => {
    mockRecorder.prepareToRecordAsync.mockRejectedValueOnce(new Error('Microphone unavailable'));
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.errorMessage).toMatch(/Microphone unavailable|Unable to start/);
  });

  it('handles error on stop failure', async () => {
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('recording'));
    mockRecorder.stop.mockRejectedValueOnce(new Error('Unable to save recording'));
    (mockRecorder as unknown as { uri: string | null }).uri = null;
    await act(async () => {
      await result.current.stopRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.errorMessage).toMatch(/Unable to save/);
  });

  it('cancel resets to idle', async () => {
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => expect(result.current.state).toBe('recording'));
    await act(async () => {
      await result.current.cancelRecording();
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('permission granted path via requestPermission', async () => {
    const { result } = renderHook(() => useAudioRecording());
    await act(async () => {
      const granted = await result.current.requestPermission();
      expect(granted).toBe(true);
    });
    expect(result.current.state).toBe('idle');
  });

  it('permission denied via requestPermission', async () => {
    mockedAudioModule.getRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: true });
    mockedAudioModule.requestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: true });
    mockedAudioModule.getRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false });
    const { result } = renderHook(() => useAudioRecording());
    let granted = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });
    expect(granted).toBe(false);
    expect(result.current.state).toBe('error');
  });
});
