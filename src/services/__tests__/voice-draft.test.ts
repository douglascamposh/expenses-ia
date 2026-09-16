import { clearVoiceTranscript, getVoiceTranscript, setVoiceTranscript } from '../voice-draft';

describe('voice-draft', () => {
  it('guarda, lee y limpia', () => {
    clearVoiceTranscript();
    expect(getVoiceTranscript()).toBeNull();
    setVoiceTranscript('  pan 100  ');
    expect(getVoiceTranscript()).toBe('pan 100');
    clearVoiceTranscript();
    expect(getVoiceTranscript()).toBeNull();
  });

  it('vacío o nulo no se guarda', () => {
    setVoiceTranscript('   ');
    expect(getVoiceTranscript()).toBeNull();
    setVoiceTranscript(null);
    expect(getVoiceTranscript()).toBeNull();
  });
});
