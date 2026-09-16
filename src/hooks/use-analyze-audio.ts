import { useCallback, useState } from 'react';

import { analyzeAudio, analyzeText, type Expense } from '@/services/expense-api';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

export function useAnalyzeAudio() {
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (localAudioUri: string, categories?: { id: string; label: string; kind: string }[]) => {
      setStatus('loading');
      setError(null);
      setExpenses(null);
      try {
        const result = await analyzeAudio(localAudioUri, 'gemini', categories);
        console.log(result.expenses);
        setExpenses(result.expenses);
        setStatus('success');
        return result;
      } catch (e) {
        const msg = (e as Error).message ?? 'Error al analizar';
        setError(msg);
        setStatus('error');
        throw e;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setExpenses(null);
    setError(null);
  }, []);

  const analyzeTextInput = useCallback(
    async (text: string, categories?: { id: string; label: string; kind: string }[]) => {
      setStatus('loading');
      setError(null);
      setExpenses(null);
      try {
        const result = await analyzeText(text, 'gemini', categories);
        setExpenses(result.expenses);
        setStatus('success');
        return result;
      } catch (e) {
        const msg = (e as Error).message ?? 'Error al analizar';
        setError(msg);
        setStatus('error');
        throw e;
      }
    },
    [],
  );

  return {
    status,
    expenses,
    error,
    isLoading: status === 'loading',
    analyze,
    analyzeText: analyzeTextInput,
    reset,
  };
}
