import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getLocales } from 'expo-localization';
import { isLocaleInstalled, resolveSpeechLocale, type AppLang } from '@/services/voice-locale';

export type SpeechStatus = 'idle' | 'starting' | 'listening' | 'done' | 'error';

export type TranscriptError = 'permission' | 'unavailable' | 'no-speech' | 'unknown';

/**
 * Transcripción por micrófono (PoC): primero intenta 100% on-device
 * (offline) y si el modelo no está disponible reintenta vía servidor.
 * Acumula parciales + finales (Android segmenta, iOS da un final).
 */
/**
 * Transcripción por micrófono (PoC): usa el idioma del celular sin forzar
 * descargas (instalado → soportado → regional). Offline solo si el modelo
 * ya está en el dispositivo; si no, vía servidor. Ante
 * language-not-supported, un reintento al es-MX/es-ES de respaldo.
 */
export function useSpeechTranscript(appLang: AppLang) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [parts, setParts] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [offline, setOffline] = useState(false);
  const [locale, setLocale] = useState(appLang === 'en' ? 'en-US' : 'es-MX');
  const [error, setError] = useState<TranscriptError | null>(null);
  const retriedServer = useRef(false);
  const retriedLocale = useRef(false);
  const appLangRef = useRef(appLang);
  useEffect(() => {
    appLangRef.current = appLang;
  }, [appLang]);

  const launch = useCallback((code: string, onDevice: boolean) => {
    setOffline(onDevice);
    ExpoSpeechRecognitionModule.start({
      lang: code,
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: true,
    });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    setParts([]);
    setInterim('');
    retriedServer.current = false;
    retriedLocale.current = false;
    setStatus('starting');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setError('unavailable');
        setStatus('error');
        return false;
      }
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        setError('permission');
        setStatus('error');
        return false;
      }
      const supported = await ExpoSpeechRecognitionModule.getSupportedLocales({}).catch(() => null);
      const deviceTag = (() => {
        try {
          return getLocales()?.[0]?.languageTag ?? '';
        } catch {
          return '';
        }
      })();
      const resolved = resolveSpeechLocale(deviceTag, supported, appLangRef.current);
      setLocale(resolved);
      const onDevice =
        ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() &&
        isLocaleInstalled(resolved, supported);
      launch(resolved, onDevice);
      return true;
    } catch {
      setError('unknown');
      setStatus('error');
      return false;
    }
  }, [launch]);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Sin módulo nativo (Expo Go): nada que detener.
    }
  }, []);

  const abort = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Sin módulo nativo (Expo Go): nada que cancelar.
    }
  }, []);

  useSpeechRecognitionEvent('start', () => setStatus('listening'));

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim() ?? '';
    if (!text) return;
    if (event.isFinal) {
      setParts((prev) => [...prev, text]);
      setInterim('');
    } else {
      setInterim(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // Locale sin modelo → respaldo es-MX/es-ES (una vez) antes de fallar.
    if (retriedLocale.current === false && event.error === 'language-not-supported') {
      retriedLocale.current = true;
      try {
        const fallback = appLangRef.current === 'en' ? 'en-US' : 'es-MX';
        setLocale(fallback);
        launch(fallback, false);
        return;
      } catch {
        // cae al error general
      }
    }
    // Offline sin modelo → un reintento vía servidor antes de fallar.
    if (retriedServer.current === false && event.error !== 'not-allowed' && event.error !== 'aborted') {
      retriedServer.current = true;
      try {
        launch(locale, false);
        return;
      } catch {
        // cae al error general
      }
    }
    if (event.error === 'not-allowed') setError('permission');
    else if (event.error === 'no-speech' || event.error === 'speech-timeout') setError('no-speech');
    else setError('unknown');
    setStatus('error');
  });

  useSpeechRecognitionEvent('nomatch', () => {
    setError('no-speech');
    setStatus('error');
  });

  useSpeechRecognitionEvent('end', () => {
    setStatus((prev) => (prev === 'listening' ? 'done' : prev));
  });

  // Al desmontar: cancelar sesión nativa.
  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Sin módulo nativo: nada que cancelar.
      }
    };
  }, []);

  const transcript = [...parts, interim].filter(Boolean).join(' ');
  return { status, transcript, interim, offline, locale, error, start, stop, abort };
}

export default useSpeechTranscript;
