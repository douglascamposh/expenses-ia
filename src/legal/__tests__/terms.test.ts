import { APP_NAME, SUPPORT_EMAIL, TERMS_EN, TERMS_ES } from '../terms';

describe('Términos y Condiciones', () => {
  it('ES y EN tienen las mismas secciones con contenido', () => {
    expect(TERMS_EN).toHaveLength(TERMS_ES.length);
    expect(TERMS_ES.length).toBeGreaterThan(10);
    for (const [i, s] of TERMS_ES.entries()) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      for (const p of s.body) expect(p.length).toBeGreaterThan(20);
      const en = TERMS_EN[i];
      expect(en.title.length).toBeGreaterThan(0);
      expect(en.body).toHaveLength(s.body.length);
      for (const p of en.body) expect(p.length).toBeGreaterThan(20);
    }
  });

  it('menciona IA no-asesoría, pagos por tiendas y contacto', () => {
    const es = TERMS_ES.map((s) => [s.title, ...s.body].join(' ')).join('\n');
    expect(es).toMatch(/asesoría financiera/i);
    expect(es).toMatch(/App Store|Google Play/);
    expect(es).toContain(SUPPORT_EMAIL);
    expect(APP_NAME.length).toBeGreaterThan(0);
  });
});
