import { flagForRegion, isLocaleInstalled, resolveSpeechLocale } from '../voice-locale';

describe('voice-locale', () => {
  const full = { locales: ['es-AR', 'es-MX', 'en-US'], installedLocales: ['es-AR', 'es-MX'] };

  it('tag exacto instalado se usa tal cual (cero descargas)', () => {
    expect(resolveSpeechLocale('es-AR', full, 'es')).toBe('es-AR');
  });

  it('tag exacto soportado pero no instalado se usa igual', () => {
    expect(resolveSpeechLocale('en-US', { locales: ['en-US'], installedLocales: [] }, 'en')).toBe('en-US');
  });

  it('es-BO (sin modelo) usa español instalado sin descargar', () => {
    // es-AR instalado gana (cero descargas) sobre el default regional
    expect(resolveSpeechLocale('es-BO', full, 'es')).toBe('es-AR');
    // Sin nada instalado en español: default regional es-MX
    expect(
      resolveSpeechLocale('es-BO', { locales: ['en-US'], installedLocales: [] }, 'es'),
    ).toBe('es-MX');
  });

  it('es-ES respeta España', () => {
    expect(
      resolveSpeechLocale('es-ES', { locales: ['es-ES', 'es-MX'], installedLocales: [] }, 'es'),
    ).toBe('es-ES');
  });

  it('sin lista usa el default de la app', () => {
    expect(resolveSpeechLocale('es-AR', null, 'es')).toBe('es-MX');
    expect(resolveSpeechLocale('', null, 'en')).toBe('en-US');
  });

  it('isLocaleInstalled distingue instalado de solo-soportado', () => {
    expect(isLocaleInstalled('es-AR', full)).toBe(true);
    expect(isLocaleInstalled('en-US', full)).toBe(false);
  });

  it('flagForRegion genera banderas y fallback', () => {
    expect(flagForRegion('AR')).toBe('🇦🇷');
    expect(flagForRegion('mx')).toBe('🇲🇽');
    expect(flagForRegion('')).toBe('🌐');
  });
});
