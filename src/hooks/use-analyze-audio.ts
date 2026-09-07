import { useCallback, useState } from 'react';

import { analyzeAudio, type Expense } from '@/services/expense-api';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

export function useAnalyzeAudio() {
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (localAudioUri: string) => {
    setStatus('loading');
    setError(null);
    setExpenses(null);
    try {
      const result = await analyzeAudio(localAudioUri, 'gemini');
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
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setExpenses(null);
    setError(null);
  }, []);

  return {
    status,
    expenses,
    error,
    isLoading: status === 'loading',
    analyze,
    reset,
  };
}
