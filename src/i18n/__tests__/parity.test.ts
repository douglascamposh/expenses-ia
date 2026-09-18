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

  it('el dict es no repite valores en inglés (estado vacío y revisión)', () => {
    // Claves cuyo valor es legítimamente idéntico en ambos idiomas.
    const allowSame = new Set([
      'settings_languageEs',
      'settings_languageEn',
      'settings_no',
      'categories_colorLabel',
      'categories_a11yColor',
    ]);
    const same = (Object.keys(STRINGS.es) as (keyof typeof STRINGS.es)[]).filter(
      (k) => typeof STRINGS.es[k] === 'string' && STRINGS.es[k] === STRINGS.en[k] && !allowSame.has(k),
    );
    expect(same).toEqual([]);
  });

  it('estado vacío y revisión de voz en español', () => {
    expect(STRINGS.es.empty_title).toMatch(/Sin gastos/);
    expect(STRINGS.es.empty_subtitle).toMatch(/registrar tus gastos/);
    expect(STRINGS.es.voice_saveAll).toMatch(/Guardar todo/);
    expect(STRINGS.es.voice_confidence).toMatch(/Confianza/);
    expect(STRINGS.es.voice_edit).toBe('Editar');
    expect(STRINGS.es.expenseConfirmation_title).toMatch(/Nuevo gasto/);
  });
});
