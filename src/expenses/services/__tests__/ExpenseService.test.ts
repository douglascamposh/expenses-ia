import { validateExpenseCommand } from '../ExpenseService';
import { ExpenseCategory } from '../../categories/expenseCategories';

describe('validateExpenseCommand', () => {
  const base = {
    action: 'CREATE_EXPENSE',
    expense: {
      amount: 35,
      currency: 'BOB',
      category: 'FOOD',
      description: 'Lunch',
      date: '2026-09-04',
    },
  };

  it('valid command → accepted', () => {
    const res = validateExpenseCommand(base);
    expect(res.valid).toBe(true);
    expect(res.normalized?.amount).toBe(35);
  });

  it('negative amount → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, amount: -5 } });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/amount/);
  });

  it('zero amount → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, amount: 0 } });
    expect(res.valid).toBe(false);
  });

  it('invalid currency → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, currency: 'XYZ' } });
    expect(res.valid).toBe(false);
  });

  it('invalid category → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, category: 'INVALID' } });
    expect(res.valid).toBe(false);
  });

  it('missing description → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, description: '' } });
    expect(res.valid).toBe(false);
  });

  it('invalid date → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, date: 'not-a-date' } });
    expect(res.valid).toBe(false);
  });

  it('acepta formato directo sin action (para NewExpense)', () => {
    const res = validateExpenseCommand({ amount: 20, currency: 'BOB', category: ExpenseCategory.TRANSPORT, description: 'Taxi', date: '2026-09-04' });
    expect(res.valid).toBe(true);
  });

  it('paymentMethod ausente → default CASH', () => {
    const res = validateExpenseCommand({ ...base });
    expect(res.valid).toBe(true);
    expect(res.normalized?.paymentMethod).toBe('CASH');
  });

  it('paymentMethod CARD válido → se conserva', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, paymentMethod: 'CARD' } });
    expect(res.valid).toBe(true);
    expect(res.normalized?.paymentMethod).toBe('CARD');
  });

  it('paymentMethod inválido → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, paymentMethod: 'BITCOIN' } });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/paymentMethod/);
  });

  it('kind ausente → default EXPENSE', () => {
    const res = validateExpenseCommand({ ...base });
    expect(res.valid).toBe(true);
    expect(res.normalized?.kind).toBe('EXPENSE');
  });

  it('kind INCOME válido → se conserva', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, kind: 'INCOME' } });
    expect(res.valid).toBe(true);
    expect(res.normalized?.kind).toBe('INCOME');
  });

  it('kind inválido → rejected', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, kind: 'REGALO' } });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/kind/);
  });

  it('categoría desconocida → rejected (la UI resuelve a la default)', () => {
    const res = validateExpenseCommand({ ...base, expense: { ...base.expense, category: 'NOEXISTE' } });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/category/);
  });
});
