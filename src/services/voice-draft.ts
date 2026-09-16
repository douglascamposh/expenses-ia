/** Borrador de transcripción de voz (PoC): vive en memoria para el siguiente paso. */
let voiceTranscript: string | null = null;

export function setVoiceTranscript(text: string | null): void {
  voiceTranscript = text && text.trim().length > 0 ? text.trim() : null;
}

export function getVoiceTranscript(): string | null {
  return voiceTranscript;
}

export function clearVoiceTranscript(): void {
  voiceTranscript = null;
}
