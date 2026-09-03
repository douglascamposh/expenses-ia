import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { formatRTF } from '@/audio/AudioConverter';

type PipelineStep = {
  label: string;
  status: string;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDurationSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LocalAITestScreen() {
  const {
    state: audioState,
    errorMessage: audioError,
    result: audioResult,
    durationMs,
    isRecording,
    startRecording,
    stopRecording,
    clearError: clearAudioError,
  } = useAudioRecording();

  const {
    status: sttStatus,
    result: transcription,
    errorMessage: sttError,
    isTranscribing,
    transcribe,
    reset: resetSTT,
  } = useSpeechToText();

  const isProcessing = audioState === 'processing';
  const isRequestingPermission = audioState === 'requesting_permission';
  const isAudioError = audioState === 'error';
  const isSTTError = sttStatus === 'error';

  // Auto-transcribe when audioResult appears and not already transcribing
  useEffect(() => {
    if (audioResult && sttStatus === 'idle' && !isTranscribing && !isRecording && !isProcessing && audioState === 'idle') {
      // Start transcription automatically (offline, no network)
      void transcribe(audioResult);
    }
  }, [audioResult, sttStatus, isTranscribing, isRecording, isProcessing, audioState, transcribe]);

  const audioStatusLabel = (() => {
    if (isRequestingPermission) return 'Requesting permission';
    if (audioState === 'recording' || isRecording) return 'Recording';
    if (isProcessing) return 'Processing';
    if (isAudioError) return 'Error';
    if (audioResult) return 'Audio ready';
    return 'Ready';
  })();

  const sttStatusLabel = (() => {
    if (sttStatus === 'loading_model') return 'Loading model';
    if (sttStatus === 'transcribing') return 'Transcribing';
    if (sttStatus === 'complete' && transcription) return 'Complete';
    if (sttStatus === 'error') return 'Error';
    return 'Ready';
  })();

  const sttDotColor = (() => {
    if (isSTTError) return '#ef4444';
    if (sttStatus === 'transcribing' || sttStatus === 'loading_model') return '#f59e0b';
    if (sttStatus === 'complete') return '#22c55e';
    return '#9ca3af';
  })();

  const audioDotColor = (() => {
    if (isAudioError) return '#ef4444';
    if (audioState === 'recording' || isRecording) return '#ef4444';
    if (isProcessing || isRequestingPermission) return '#f59e0b';
    return '#22c55e';
  })();

  const pipelineSteps: PipelineStep[] = [
    { label: 'Audio', status: audioResult || isRecording || isProcessing ? 'Ready' : 'Ready' },
    { label: 'Whisper', status: sttStatus === 'complete' ? 'Ready' : sttStatus === 'transcribing' ? 'Transcribing' : sttStatus === 'loading_model' ? 'Loading' : 'Ready' },
    { label: 'Local LLM', status: 'Not implemented' },
    { label: 'JSON Command', status: 'Not implemented' },
    { label: 'Validation', status: 'Ready' },
  ];

  const handlePressRecord = useCallback(() => {
    resetSTT();
    void startRecording();
  }, [resetSTT, startRecording]);

  const handleStop = useCallback(() => {
    void stopRecording();
  }, [stopRecording]);

  const handleRetry = useCallback(() => {
    if (isAudioError) clearAudioError();
    if (isSTTError) resetSTT();
  }, [isAudioError, isSTTError, clearAudioError, resetSTT]);

  const disableRecord = isTranscribing || isProcessing || isRequestingPermission || sttStatus === 'loading_model';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Local AI Test
          </ThemedText>
          <View style={styles.runtimeBadge}>
            <View style={styles.offlineDot} />
            <ThemedText type="smallBold">Runtime</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Offline
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Local-first / Offline-first POC — no backend, no cloud
          </ThemedText>
        </View>

        <View style={styles.pipelineHeader}>
          <ThemedText type="smallBold">AI Pipeline</ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.pipelineCard}>
          {pipelineSteps.map((step, idx) => (
            <View key={step.label} style={styles.stepRow}>
              <View style={styles.stepBox}>
                <ThemedText type="smallBold" style={styles.stepLabel}>
                  {step.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {step.status}
                </ThemedText>
              </View>
              {idx < pipelineSteps.length - 1 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.arrow}>
                  ↓
                </ThemedText>
              )}
            </View>
          ))}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.audioCard}>
          <ThemedText type="smallBold">Audio</ThemedText>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: audioDotColor }]} />
            <ThemedText type="smallBold">Status: {audioStatusLabel}</ThemedText>
          </View>

          {(audioState === 'recording' || isRecording) && (
            <ThemedText type="small" themeColor="textSecondary">
              Duration: {formatDuration(durationMs)}
            </ThemedText>
          )}

          {audioResult && audioState === 'idle' && !isAudioError && (
            <View style={styles.resultBox}>
              <ThemedText type="smallBold">Audio ready</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Duration: {formatDurationSeconds(audioResult.durationMs)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Format: {audioResult.format} • {audioResult.mimeType}
              </ThemedText>
              <ThemedText type="code" style={styles.filePath}>
                {audioResult.filePath}
              </ThemedText>
            </View>
          )}

          {isAudioError && audioError && (
            <View style={styles.errorBox}>
              <ThemedText type="smallBold" style={styles.errorTitle}>
                {audioError.includes('permission') || audioError.includes('Permission')
                  ? 'Microphone permission required'
                  : 'Recording error'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                {audioError.includes('permission') || audioError.includes('Permission')
                  ? 'The microphone permission is required to record your voice commands.'
                  : audioError}
              </ThemedText>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [styles.tryAgainButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.tryAgainText}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.buttonRow}>
            {audioState === 'recording' || isRecording ? (
              <Pressable
                onPress={handleStop}
                style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.stopText}>
                  Stop Recording
                </ThemedText>
              </Pressable>
            ) : isProcessing || isRequestingPermission ? (
              <View style={styles.disabledButton}>
                <ThemedText type="small" themeColor="textSecondary">
                  {isRequestingPermission ? 'Requesting permission…' : 'Processing…'}
                </ThemedText>
              </View>
            ) : isAudioError ? null : (
              <Pressable
                onPress={handlePressRecord}
                disabled={disableRecord}
                style={({ pressed }) => [
                  styles.startButton,
                  disableRecord && styles.disabledButton,
                  pressed && !disableRecord && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={styles.startText}>
                  {disableRecord ? 'Processing…' : 'Start Recording'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>

        {/* Speech-to-Text Card */}
        <ThemedView type="backgroundElement" style={styles.audioCard}>
          <ThemedText type="smallBold">Speech-to-Text</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Model: Tiny • Language: Spanish • Runtime: whisper.cpp
          </ThemedText>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: sttDotColor }]} />
            <ThemedText type="smallBold">Status: {sttStatusLabel}</ThemedText>
          </View>

          {(sttStatus === 'transcribing' || sttStatus === 'loading_model') && (
            <ThemedText type="small" themeColor="textSecondary">
              {sttStatus === 'loading_model' ? 'Loading model…' : 'Transcribing…'}
            </ThemedText>
          )}

          {transcription && sttStatus === 'complete' && (
            <View style={styles.resultBox}>
              <ThemedText type="smallBold">Transcription:</ThemedText>
              <ThemedText type="small" style={styles.transcriptionText}>
                &quot;{transcription.text}&quot;
              </ThemedText>
              <View style={styles.metricsRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Processing time: {formatDurationSeconds(transcription.transcriptionDurationMs)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Audio duration: {formatDurationSeconds(transcription.audioDurationMs)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Realtime factor: {formatRTF(transcription.rtf)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Model: {transcription.modelName ?? 'Tiny'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Model size: {formatBytes(transcription.modelSizeBytes)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Memory: {transcription.memoryUsageBytes ? formatBytes(transcription.memoryUsageBytes) : 'unavailable'}
                </ThemedText>
                {transcription.language && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Language: {transcription.language}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {isSTTError && sttError && (
            <View style={styles.errorBox}>
              <ThemedText type="smallBold" style={styles.errorTitle}>
                Transcription error
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                {sttError}
              </ThemedText>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [styles.tryAgainButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.tryAgainText}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ThemedView>

        <View style={styles.footer}>
          <ThemedText type="code" style={styles.footerText}>
            Audio → Whisper → LLM → JSON → Validation
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
            Works in airplane mode • Temporary file for transcription only
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
  },
  subtitle: {
    textAlign: 'center',
  },
  runtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0E1E6',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  pipelineHeader: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  pipelineCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  stepRow: {
    alignItems: 'center',
    width: '100%',
  },
  stepBox: {
    minWidth: 180,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#E0E1E6',
    alignItems: 'center',
    gap: 2,
  },
  stepLabel: {
    textAlign: 'center',
  },
  arrow: {
    paddingVertical: 2,
    fontSize: 16,
  },
  audioCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultBox: {
    alignItems: 'center',
    gap: 2,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#E0E1E6',
    width: '100%',
  },
  filePath: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  transcriptionText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 4,
  },
  metricsRow: {
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  errorBox: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    width: '100%',
  },
  errorTitle: {
    color: '#dc2626',
  },
  errorText: {
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.one,
  },
  startButton: {
    backgroundColor: '#208AEF',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  startText: {
    color: '#ffffff',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  stopText: {
    color: '#ffffff',
  },
  tryAgainButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: Spacing.one,
  },
  tryAgainText: {
    color: '#dc2626',
  },
  disabledButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0E1E6',
    minWidth: 160,
    alignItems: 'center',
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  footerText: {
    textAlign: 'center',
  },
  footerHint: {
    textAlign: 'center',
  },
});

export default LocalAITestScreen;
