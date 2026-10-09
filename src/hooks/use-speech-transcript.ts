import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getLocales } from 'expo-localization';
import { isLocaleInstalled, resolveSpeechLocale, type AppLang } from '@/services/voice-locale';
import { logApiError, logApiWarn } from '@/utils/debug-log';

export type SpeechStatus = 'idle' | 'starting' | 'listening' | 'done' | 'error';

export type TranscriptError = 'permission' | 'unavailable' | 'no-speech' | 'unknown';

/** Silencios tolerados con relanzamiento antes de mostrar error. */
const MAX_SILENCE_RESTARTS = 2;

/**
 * Transcripción por micrófono: usa el idioma del celular sin forzar
 * descargas (instalado → soportado → regional). Offline solo si el modelo
 * ya está en el dispositivo; si no, vía servidor. Ante
 * language-not-supported, un reintento al es-MX/es-ES de respaldo.
 * Escucha continua hasta cierre manual (✓/X): Android corta por pausas,
 * así que ante silencio/timeout/end se conserva lo dictado y se relanza.
 * Acumula parciales + finales (Android segmenta, iOS da un final).
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
  const heardRef = useRef(false);
  const interimRef = useRef('');
  const manualStopRef = useRef(false);
  const silenceRestarts = useRef(0);
  const lastLaunchRef = useRef<{ code: string; onDevice: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const appLangRef = useRef(appLang);
  useEffect(() => {
    appLangRef.current = appLang;
  }, [appLang]);

  const launch = useCallback((code: string, onDevice: boolean) => {
    setOffline(onDevice);
    lastLaunchRef.current = { code, onDevice };
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
    interimRef.current = '';
    retriedServer.current = false;
    retriedLocale.current = false;
    heardRef.current = false;
    manualStopRef.current = false;
    silenceRestarts.current = 0;
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
    manualStopRef.current = true;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Sin módulo nativo (Expo Go): nada que detener.
    }
    setStatus('done');
  }, []);

  const abort = useCallback(() => {
    manualStopRef.current = true;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Sin módulo nativo (Expo Go): nada que cancelar.
    }
    setStatus('done');
  }, []);

  /** Mueve el interim actual a parts (evita perder lo dictado antes de una pausa). */
  const commitInterim = useCallback(() => {
    const text = interimRef.current.trim();
    if (!text) return;
    interimRef.current = '';
    setInterim('');
    setParts((prev) => {
      const last = prev[prev.length - 1];
      if (last === text) return prev;
      // Android puede reenviar acumulado ("hoy gasté" y luego "hoy gasté 20");
      // conserva la versión más larga en vez de duplicar.
      if (last && text.includes(last)) return [...prev.slice(0, -1), text];
      if (last && last.includes(text)) return prev;
      return [...prev, text];
    });
  }, []);

  useSpeechRecognitionEvent('start', () => setStatus('listening'));

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim() ?? '';
    if (!text) return;
    heardRef.current = true;
    if (event.isFinal) {
      interimRef.current = '';
      setInterim('');
      setParts((prev) => {
        const last = prev[prev.length - 1];
        if (last === text) return prev;
        if (last && text.includes(last)) return [...prev.slice(0, -1), text];
        if (last && last.includes(text)) return prev;
        return [...prev, text];
      });
    } else {
      interimRef.current = text;
      setInterim(text);
    }
  });

  /**
   * Escucha continua hasta cierre manual (✓/X): ante silencio/timeout se
   * conserva lo dictado (incluido el interim) y se relanza la escucha.
   * Solo el silencio inicial en vacío muestra error tras MAX_SILENCE_RESTARTS.
   */
  const relaunch = useCallback(() => {
    const last = lastLaunchRef.current;
    if (!last) return false;
    try {
      launch(last.code, last.onDevice);
      setStatus('listening');
      return true;
    } catch {
      return false;
    }
  }, [launch]);

  const handleSilence = useCallback(() => {
    commitInterim();
    if (heardRef.current) {
      logApiWarn('speech', 'pausa: continúa escuchando', undefined);
      if (relaunch()) return;
    }
    if (silenceRestarts.current < MAX_SILENCE_RESTARTS) {
      silenceRestarts.current += 1;
      const last = lastLaunchRef.current;
      logApiWarn('speech', 'silencio: relanzando escucha', { attempt: silenceRestarts.current });
      if (last) {
        try {
          launch(last.code, last.onDevice);
          return;
        } catch {
          // cae al error general
        }
      }
    }
    setError('no-speech');
    setStatus('error');
  }, [commitInterim, relaunch, launch]);

  useSpeechRecognitionEvent('error', (event) => {
    if (manualStopRef.current) return;
    const code = String((event as { error?: unknown })?.error ?? 'unknown');
    logApiError('speech', new Error(`reconocimiento: ${code}`), { code });
    // Silencio/timeout con política propia (no gasta el reintento de servidor).
    if (code === 'no-speech' || code === 'speech-timeout') {
      handleSilence();
      return;
    }
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
        launch(lastLaunchRef.current?.code ?? locale, false);
        return;
      } catch {
        // cae al error general
      }
    }
    if (event.error === 'not-allowed') setError('permission');
    else setError('unknown');
    setStatus('error');
  });

  useSpeechRecognitionEvent('nomatch', () => {
    logApiWarn('speech', 'sin coincidencia de audio');
    handleSilence();
  });

  useSpeechRecognitionEvent('end', () => {
    // Cierre manual (✓/X o desmontaje): finalizar. Corte espontáneo de
    // Android tras una pausa: conservar interim y seguir escuchando.
    if (manualStopRef.current) {
      setStatus('done');
      return;
    }
    if (statusRef.current !== 'listening' && statusRef.current !== 'starting') return;
    commitInterim();
    logApiWarn('speech', 'sesión cortada: continúa escuchando', undefined);
    relaunch();
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
