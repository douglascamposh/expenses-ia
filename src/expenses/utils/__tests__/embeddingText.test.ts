import { buildBilingualEmbeddingText, buildEmbeddingText } from '../embeddingText';
import { ExpenseCategory } from '../../categories/expenseCategories';

const base = {
  description: 'Compra en Amazon',
  category: ExpenseCategory.SHOPPING,
  amount: 250,
  currency: 'BOB' as const,
  paymentMethod: 'CASH' as const,
};

describe('buildEmbeddingText', () => {
  it('ES incluye frase de pago en español', () => {
    const t = buildEmbeddingText(base, 'es');
    expect(t).toContain('Compra en Amazon');
    expect(t).toContain('Compras');
    expect(t).toContain('250 BOB');
    expect(t).toContain('pagado en efectivo');
  });

  it('EN incluye frase de pago en inglés', () => {
    const t = buildEmbeddingText(base, 'en');
    expect(t).toContain('paid in cash');
    expect(t).toContain('Shopping');
  });

  it('CARD usa frase de tarjeta en cada idioma', () => {
    expect(buildEmbeddingText({ ...base, paymentMethod: 'CARD' }, 'es')).toContain('pagado con tarjeta');
    expect(buildEmbeddingText({ ...base, paymentMethod: 'CARD' }, 'en')).toContain('paid by card');
  });

  it('bilingüe concatena ES + EN', () => {
    const t = buildBilingualEmbeddingText(base);
    expect(t).toContain('pagado en efectivo');
    expect(t).toContain('paid in cash');
  });

  it('sin método usa CASH', () => {
    const { paymentMethod: _omit, ...rest } = base;
    expect(buildEmbeddingText(rest, 'es')).toContain('pagado en efectivo');
  });
});
