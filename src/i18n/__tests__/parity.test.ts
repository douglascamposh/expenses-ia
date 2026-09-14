import { STRINGS } from '../translations';

function keysOf(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[]`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      keysOf(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('i18n parity es/en', () => {
  it('mismas claves en ambos idiomas', () => {
    expect(keysOf(STRINGS.en).sort()).toEqual(keysOf(STRINGS.es).sort());
  });

  it('sin strings vacíos', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const v of Object.values(STRINGS[lang])) {
        if (typeof v === 'string') expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});
