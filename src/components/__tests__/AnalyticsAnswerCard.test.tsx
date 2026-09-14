import { render } from '@testing-library/react-native';
import { AnalyticsAnswerCard } from '../AnalyticsAnswerCard';
import type { AnalyticsAnswer } from '@/store/expensesSlice';

describe('AnalyticsAnswerCard', () => {
  it('total muestra título de alcance y valor', () => {
    const answer: AnalyticsAnswer = {
      kind: 'total', value: 490, currency: 'BOB', expenseIds: ['a', 'b'], count: 2,
      scope: 'este mes', category: null, categoryLabel: null, preview: null,
    };
    const { getByText } = render(<AnalyticsAnswerCard answer={answer} />);
    expect(getByText('Total este mes')).toBeTruthy();
    expect(getByText(/490/)).toBeTruthy();
    expect(getByText(/2 gastos/)).toBeTruthy();
  });

  it('max muestra título y preview', () => {
    const answer: AnalyticsAnswer = {
      kind: 'max', value: 350, currency: 'BOB', expenseIds: ['a'], count: 1,
      scope: 'este mes', category: 'ENTERTAINMENT', categoryLabel: 'Entretenimiento',
      preview: { description: 'Cine', date: '2026-09-05' },
    };
    const { getByText } = render(<AnalyticsAnswerCard answer={answer} />);
    expect(getByText('Gasto más fuerte')).toBeTruthy();
    expect(getByText(/350/)).toBeTruthy();
    expect(getByText(/Cine/)).toBeTruthy();
  });
});
