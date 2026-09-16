import * as FileSystem from 'expo-file-system/legacy';

import { getAuthToken } from './auth';

/**
 * Expense API — envía audio a endpoint cloud y recibe gastos estructurados.
 * Basado en ejemplo del usuario: FormData { audio: {uri,name,type}, model: 'gemini', currentDate }
 * Base URL: https://expense-audio-analyzer-571414320359.us-east1.run.app
 */

export const ANALYZE_ENDPOINT =
  'https://expense-audio-analyzer-571414320359.us-east1.run.app/api/analyze';

export const ANALYZE_TEXT_ENDPOINT =
  'https://expense-audio-analyzer-571414320359.us-east1.run.app/api/analyze-text';

export const EMBED_ENDPOINT =
  'https://expense-audio-analyzer-571414320359.us-east1.run.app/api/embed';

export type EmbedResult = {
  vector: Float32Array;
  model: string;
  dims: number;
};

export class EmbedError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'EmbedError';
    this.status = status;
  }
}

export type Expense = {
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
  date?: string;
  // La API puede devolver más campos; mantenemos índice abierto
  [key: string]: unknown;
};

export type AnalyzeResponse = {
  expenses?: Expense[];
  actions?: { action: string; expense?: Expense; [key: string]: unknown }[];
  latency?: number;
  error?: string;
  data?: Expense[];
  result?: Expense[];
  [key: string]: unknown;
};

export type AnalyzeResult = {
  expenses: Expense[];
  raw: AnalyzeResponse | Expense[];
  latency?: number;
};

export class AnalyzeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AnalyzeError';
    this.status = status;
  }
}

/**
 * HTTP que indican que el servicio de IA no está disponible *ahora*:
 * 503 por alta demanda, 502/504 de la plataforma, 429 rate limit, etc.
 */
const UNAVAILABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Fragmentos que aparecen en el cuerpo del backend cuando el modelo está
 * saturado (p. ej. "this model is currently experiencing high demand").
 */
const UNAVAILABLE_HINTS = [
  'high demand',
  'unavailable',
  'overloaded',
  'over capacity',
  'try again later',
  'temporarily',
  'resource exhausted',
];

/**
 * True cuando el fallo es del servicio (no del request del usuario).
 * Las pantallas lo usan para mostrar un mensaje amable en vez del error
 * crudo del backend.
 */
export function isServiceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && UNAVAILABLE_STATUSES.has(status)) return true;
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return UNAVAILABLE_HINTS.some((hint) => message.includes(hint));
}

/**
 * fetch con `Authorization: Bearer <Firebase ID token>`.
 * El backend valida el token con Admin SDK y ata la cuota al UID.
 * Ante un 401 reintenta una sola vez con token forzadamente fresco.
 */
async function fetchWithAuth(url: string, init: RequestInit): Promise<Response> {
  const call = async (forceRefresh: boolean): Promise<Response> => {
    const token = await getAuthToken(forceRefresh);
    const headers = { ...(init.headers as Record<string, string> | undefined) };
    headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...init, headers });
  };
  const first = await call(false);
  if (first.status === 401) return call(true);
  return first;
}

/**
 * Envía audio local a la API y retorna gastos estructurados.
 * @param localAudioUri - filePath/uri del AudioRecordingResult (file://...)
 * @param model - modelo a usar, por defecto 'gemini'
 * @param categories - categorías del usuario para que la IA haga match
 *   ([{id,label,kind}]); la IA debe devolver un id existente o el default.
 */
export async function analyzeAudio(
  localAudioUri: string,
  model: string = 'gemini',
  categories?: { id: string; label: string; kind: string }[],
): Promise<AnalyzeResult> {
  if (!localAudioUri || typeof localAudioUri !== 'string') {
    throw new AnalyzeError('Audio no válido');
  }

  const formData = new FormData();
  // Fix "Unsupported formDataPart implementation": Hono/Cloud Run espera Blob+filename, no objeto {uri}
  // 1) Intentar Blob vía fetch(file://)  2) Fallback via expo-file-system Base64  3) Último fallback objeto uri
  let audioAppended = false;
  try {
    const fileRes = await fetch(localAudioUri);
    if (fileRes.ok) {
      const blob = await fileRes.blob();
      const typedBlob = blob.type ? blob : new Blob([blob], { type: 'audio/m4a' });
      formData.append('audio', typedBlob, 'recording.m4a');
      audioAppended = true;
    }
  } catch {
    // ignore, try next method
  }

  if (!audioAppended) {
    try {
      const base64 = await FileSystem.readAsStringAsync(localAudioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/m4a' });
      formData.append('audio', blob, 'recording.m4a');
      audioAppended = true;
    } catch {
      // último fallback: objeto uri (React Native extension)
    }
  }

  if (!audioAppended) {
    formData.append('audio', {
      uri: localAudioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as unknown as Blob);
  }
  formData.append('model', model);
  const localDate = new Date().toISOString().split('T')[0];
  formData.append('currentDate', localDate);
  if (categories && categories.length > 0) {
    formData.append('categories', JSON.stringify(categories));
  }

  let response: Response;
  try {
    console.log('Enviando audio al servidor...');
    response = await fetchWithAuth(ANALYZE_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
        // Content-Type lo asigna fetch automáticamente con boundary para multipart
      },
    });
  } catch (e) {
    throw new AnalyzeError((e as Error).message ?? 'Error de red al analizar audio');
  }

  let json: AnalyzeResponse | Expense[] = {} as AnalyzeResponse;
  try {
    json = (await response.json()) as AnalyzeResponse | Expense[];
  } catch {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AnalyzeError(`Error ${response.status}: ${text || response.statusText}`.trim(), response.status);
    }
    throw new AnalyzeError('Respuesta inválida del servidor');
  }

  if (!response.ok) {
    const errMsg = (json as AnalyzeResponse)?.error as string | undefined;
    throw new AnalyzeError((errMsg as string) || `Error ${response.status} procesando el audio`, response.status);
  }

  // Log latencia si viene
  if (!Array.isArray(json) && typeof (json as AnalyzeResponse).latency === 'number') {
    console.log('✅ Análisis exitoso. Latencia:', (json as AnalyzeResponse).latency, 'ms');
  }

  // Normalizar: priorizar data.actions → CREATE_EXPENSE (formato correcto del ejemplo)
  const expenses = normalizeAnalyzeResponse(json);

  console.log('Gastos detectados:', expenses);
  const latency = !Array.isArray(json) ? (json as AnalyzeResponse).latency : undefined;
  return { expenses, raw: json, latency };
}

/** Normaliza cualquier forma de respuesta del backend a lista de gastos. */
export function normalizeAnalyzeResponse(json: AnalyzeResponse | Expense[]): Expense[] {
  let expenses: Expense[] = [];
  if (!Array.isArray(json) && Array.isArray((json as AnalyzeResponse).actions)) {
    const actions = (json as AnalyzeResponse).actions as { action: string; expense?: Expense }[];
    expenses = actions.filter((a) => a.action === 'CREATE_EXPENSE').map((a) => a.expense as Expense).filter(Boolean);
    // si no hay CREATE_EXPENSE pero hay actions, devolverlas tal cual
    if (expenses.length === 0 && actions.length > 0) {
      expenses = actions as unknown as Expense[];
    }
  } else if (Array.isArray(json)) {
    expenses = json;
  } else if (Array.isArray((json as AnalyzeResponse).expenses)) {
    expenses = (json as AnalyzeResponse).expenses as Expense[];
  } else if (Array.isArray((json as AnalyzeResponse).data)) {
    expenses = (json as AnalyzeResponse).data as Expense[];
  } else if (Array.isArray((json as AnalyzeResponse).result)) {
    expenses = (json as AnalyzeResponse).result as Expense[];
  } else if (json && typeof json === 'object') {
    const maybeExpenses = (json as Record<string, unknown>).expenses;
    if (Array.isArray(maybeExpenses)) expenses = maybeExpenses as Expense[];
  }
  return expenses;
}

export type AnalyzeTextInput = {
  text: string;
  categories?: { id: string; label: string; kind: string }[] | string[];
  model?: string;
  currentDate?: string;
};

/**
 * Envía texto transcrito a la API y retorna gastos estructurados.
 * Mismo contrato de respuesta que analyzeAudio (actions CREATE_EXPENSE).
 * Request: POST JSON { text, categories, model, currentDate }.
 */
export async function analyzeText(
  text: string,
  model: string = 'gemini',
  categories?: { id: string; label: string; kind: string }[] | string[],
  currentDate?: string,
): Promise<AnalyzeResult> {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (clean.length === 0) {
    throw new AnalyzeError('Texto vacío para analizar');
  }
  const body: AnalyzeTextInput = {
    text: clean,
    categories: categories ?? [],
    model,
    currentDate: currentDate ?? new Date().toISOString().split('T')[0],
  };

  let response: Response;
  try {
    response = await fetchWithAuth(ANALYZE_TEXT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AnalyzeError((e as Error).message ?? 'Error de red al analizar texto');
  }

  let json: AnalyzeResponse | Expense[] = {} as AnalyzeResponse;
  try {
    json = (await response.json()) as AnalyzeResponse | Expense[];
  } catch {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AnalyzeError(`Error ${response.status}: ${text || response.statusText}`.trim(), response.status);
    }
    throw new AnalyzeError('Respuesta inválida del servidor');
  }

  if (!response.ok) {
    const errMsg = (json as AnalyzeResponse)?.error as string | undefined;
    throw new AnalyzeError((errMsg as string) || `Error ${response.status} procesando el texto`, response.status);
  }

  if (!Array.isArray(json) && typeof (json as AnalyzeResponse).latency === 'number') {
    console.log('✅ Análisis de texto exitoso. Latencia:', (json as AnalyzeResponse).latency, 'ms');
  }

  const expenses = normalizeAnalyzeResponse(json);
  console.log('Gastos detectados (texto):', expenses);
  const latency = !Array.isArray(json) ? (json as AnalyzeResponse).latency : undefined;
  return { expenses, raw: json, latency };
}

/**
 * Genera el embedding de un texto vía backend.
 * Contrato: POST { text } → { embedding: number[], model?: string, dims?: number }.
 * Defensivo: acepta `embedding`/`vector`/`data` como vector y deriva dims/model si faltan.
 */
export async function embedText(text: string, endpoint: string = EMBED_ENDPOINT): Promise<EmbedResult> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new EmbedError('Texto vacío para embedding');
  }
  let response: Response;
  try {
    response = await fetchWithAuth(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    throw new EmbedError((e as Error).message ?? 'Error de red al generar embedding');
  }
  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new EmbedError('Respuesta inválida del endpoint de embeddings', response.status);
  }
  if (!response.ok) {
    const errMsg = typeof json?.error === 'string' ? json.error : undefined;
    throw new EmbedError(errMsg || `Error ${response.status} generando embedding`, response.status);
  }
  const raw = json.embedding ?? json.vector ?? json.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new EmbedError('El backend no devolvió embedding');
  }
  const vector = Float32Array.from(raw, (v) => {
    const n = Number(v);
    if (!isFinite(n)) throw new EmbedError('Embedding con valores no numéricos');
    return n;
  });
  const dims = typeof json.dims === 'number' && json.dims > 0 ? json.dims : vector.length;
  if (dims !== vector.length) {
    throw new EmbedError(`Dims inconsistentes: esperado ${dims}, recibido ${vector.length}`);
  }
  const model = typeof json.model === 'string' && json.model.length > 0 ? json.model : 'backend-default';
  return { vector, model, dims };
}
