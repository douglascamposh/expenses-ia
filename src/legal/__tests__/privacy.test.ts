import { APP_NAME, SUPPORT_EMAIL, PRIVACY_EN, PRIVACY_ES } from '../privacy';

describe('Política de Privacidad', () => {
  it('ES y EN tienen las mismas secciones con contenido', () => {
    expect(PRIVACY_EN).toHaveLength(PRIVACY_ES.length);
    expect(PRIVACY_ES.length).toBeGreaterThan(5);
    for (const [i, s] of PRIVACY_ES.entries()) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      for (const p of s.body) expect(p.length).toBeGreaterThan(20);
      const en = PRIVACY_EN[i];
      expect(en.title.length).toBeGreaterThan(0);
      expect(en.body).toHaveLength(s.body.length);
      for (const p of en.body) expect(p.length).toBeGreaterThan(20);
    }
  });

  it('avisa envío a LLM, respaldo Pro en la nube y terceros', () => {
    const es = PRIVACY_ES.map((s) => [s.title, ...s.body].join(' ')).join('\n');
    expect(es).toMatch(/modelo de lenguaje|LLM/);
    expect(es).toMatch(/nube/);
    expect(es).toMatch(/Firebase|RevenueCat/);
    expect(es).toMatch(/No vendemos tus datos/i);
    expect(APP_NAME.length).toBeGreaterThan(0);
    expect(SUPPORT_EMAIL.length).toBeGreaterThan(0);
  });
});
