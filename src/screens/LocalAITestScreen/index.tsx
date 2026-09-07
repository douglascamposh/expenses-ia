import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useAnalyzeAudio } from '@/hooks/use-analyze-audio';

type PipelineStep = {
  label: string;
  status: string;
};

const PIPELINE_STEPS: PipelineStep[] = [
  { label: 'Audio', status: 'Ready' },
  { label: 'Whisper', status: 'API (cloud) — pending' },
  { label: 'Local LLM', status: 'Not implemented' },
  { label: 'JSON Command', status: 'Not implemented' },
  { label: 'Validation', status: 'Ready' },
];

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

export function LocalAITestScreen() {
  const {
    state,
    errorMessage,
    result,
    durationMs,
    isRecording,
    startRecording,
    stopRecording,
    clearError,
  } = useAudioRecording();
  const { status: analyzeStatus, expenses, error: analyzeError, isLoading: isAnalyzing, analyze, reset: resetAnalyze } = useAnalyzeAudio();

  const isProcessing = state === 'processing';
  const isRequestingPermission = state === 'requesting_permission';
  const isError = state === 'error';

  const statusLabel = (() => {
    if (isRequestingPermission) return 'Requesting permission';
    if (state === 'recording' || isRecording) return 'Recording';
    if (isProcessing) return 'Processing';
    if (isError) return 'Error';
    if (result) return 'Audio ready';
    return 'Ready';
  })();

  const statusDotColor = (() => {
    if (isError) return '#ef4444';
    if (state === 'recording' || isRecording) return '#ef4444';
    if (isProcessing || isRequestingPermission) return '#f59e0b';
    return '#22c55e';
  })();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
            Local-first / Offline-first POC — audio → API cloud
          </ThemedText>
        </View>

        <View style={styles.pipelineHeader}>
          <ThemedText type="smallBold">AI Pipeline</ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.pipelineCard}>
          {PIPELINE_STEPS.map((step, idx) => (
            <View key={step.label} style={styles.stepRow}>
              <View style={styles.stepBox}>
                <ThemedText type="smallBold" style={styles.stepLabel}>
                  {step.label}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {step.status}
                </ThemedText>
              </View>
              {idx < PIPELINE_STEPS.length - 1 && (
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
            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
            <ThemedText type="smallBold">Status: {statusLabel}</ThemedText>
          </View>

          {(state === 'recording' || isRecording) && (
            <ThemedText type="small" themeColor="textSecondary">
              Duration: {formatDuration(durationMs)}
            </ThemedText>
          )}

          {result && state === 'idle' && !isError && (
            <View style={styles.resultBox}>
              <ThemedText type="smallBold">Audio ready — listo para enviar a API</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Duration: {formatDurationSeconds(result.durationMs)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Format: {result.format} • {result.mimeType}
              </ThemedText>
              <ThemedText type="code" style={styles.filePath}>
                {result.filePath}
              </ThemedText>
              <Pressable
                onPress={() => void analyze(result.filePath)}
                disabled={isAnalyzing}
                style={({ pressed }) => [
                  styles.analyzeButton,
                  isAnalyzing && styles.disabledButton,
                  pressed && !isAnalyzing && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={styles.analyzeText}>
                  {isAnalyzing ? 'Analizando…' : 'Analizar gasto'}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {analyzeStatus !== 'idle' && (
            <View style={styles.resultBox}>
              <ThemedText type="smallBold">
                {analyzeStatus === 'loading' ? 'Analizando audio…' : analyzeStatus === 'success' ? 'Gastos detectados' : 'Error'}
              </ThemedText>
              {analyzeStatus === 'success' && expenses && (
                <View style={styles.expensesBox}>
                  {expenses.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      No se detectaron gastos
                    </ThemedText>
                  ) : (
                    expenses.map((exp, idx) => (
                      <View key={idx} style={styles.expenseItem}>
                        <ThemedText type="small" style={styles.expenseText}>
                          {JSON.stringify(exp, null, 2)}
                        </ThemedText>
                      </View>
                    ))
                  )}
                </View>
              )}
              {analyzeStatus === 'error' && analyzeError && (
                <View style={styles.errorBox}>
                  <ThemedText type="small" style={styles.errorText}>
                    {analyzeError}
                  </ThemedText>
                  <Pressable
                    onPress={() => result && void analyze(result.filePath)}
                    style={({ pressed }) => [styles.tryAgainButton, pressed && styles.pressed]}
                  >
                    <ThemedText type="smallBold" style={styles.tryAgainText}>
                      Reintentar
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              {analyzeStatus !== 'loading' && (
                <Pressable
                  onPress={resetAnalyze}
                  style={({ pressed }) => [styles.tryAgainButton, pressed && styles.pressed]}
                >
                  <ThemedText type="smallBold" style={styles.tryAgainText}>
                    Limpiar
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {isError && errorMessage && (
            <View style={styles.errorBox}>
              <ThemedText type="smallBold" style={styles.errorTitle}>
                {errorMessage.includes('permission') || errorMessage.includes('Permission')
                  ? 'Microphone permission required'
                  : 'Recording error'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                {errorMessage.includes('permission') || errorMessage.includes('Permission')
                  ? 'The microphone permission is required to record your voice commands.'
                  : errorMessage}
              </ThemedText>
              <Pressable
                onPress={clearError}
                style={({ pressed }) => [styles.tryAgainButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.tryAgainText}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.buttonRow}>
            {state === 'recording' || isRecording ? (
              <Pressable
                onPress={() => void stopRecording()}
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
            ) : isError ? null : (
              <Pressable
                onPress={() => void startRecording()}
                style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" style={styles.startText}>
                  Start Recording
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>

          <View style={styles.footer}>
            <ThemedText type="code" style={styles.footerText}>
              Audio → API → LLM → JSON → Validation
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
              Grabación local • Transcripción vía API cloud (próximo paso)
            </ThemedText>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
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
  },
  analyzeButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  analyzeText: {
    color: '#ffffff',
  },
  expensesBox: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  expenseItem: {
    width: '100%',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  expenseText: {
    fontSize: 12,
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
