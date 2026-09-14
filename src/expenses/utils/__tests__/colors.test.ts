import { pastel, resolveColor } from '../colors';

describe('resolveColor', () => {
  it('respeta hex válido con o sin #', () => {
    expect(resolveColor('#ef4444')).toBe('#ef4444');
    expect(resolveColor('3b82f6')).toBe('#3b82f6');
  });

  it('sin color asigna uno fijo por id (determinístico)', () => {
    const a = resolveColor(undefined, 'FOOD');
    const b = resolveColor('', 'FOOD');
    const c = resolveColor('no-es-color', 'FOOD');
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toMatch(/^#[0-9a-f]{6}$/i);
    expect(resolveColor(undefined, 'OTRA')).toBeDefined();
  });
});

describe('pastel', () => {
  it('nunca devuelve gris por defecto: siempre tiñe', () => {
    expect(pastel(undefined, 0.45, 'FOOD')).not.toBe('#EDEDEA');
    expect(pastel('#ef4444', 0.45, 'FOOD')).toMatch(/^rgb\(/);
  });
});
