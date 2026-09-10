import { fireEvent, render } from '@testing-library/react-native';
import { UnifiedCategories } from '../UnifiedCategories';

const budgets = [
  { category: 'FOOD', currency: 'BOB', limit: 200, spent: 120, pct: 0.6, over: false },
];
const summary = [
  { category: 'FOOD', currency: 'BOB', total: 120 },
  { category: 'TRANSPORT', currency: 'BOB', total: 350 },
];

describe('UnifiedCategories (lista única estilo mockup)', () => {
  it('cada categoría sale una sola vez: con presupuesto estilo budget, sin él solo gasto', () => {
    const { getAllByText, getByText, queryByText } = render(
      <UnifiedCategories loading={false} budgets={budgets as never} summary={summary as never} onOpenCategory={() => {}} onSeeAll={() => {}} />,
    );
    // FOOD una sola vez, con formato presupuesto
    expect(getAllByText('Food')).toHaveLength(1);
    expect(getByText('Bs 120 / 200')).toBeTruthy();
    expect(getByText('60%')).toBeTruthy();
    // TRANSPORT sin presupuesto: solo gastado, sin % propio
    expect(getByText('Bs 350 gastados')).toBeTruthy();
    expect(queryByText('Bs 350 /')).toBeNull();
  });

  it('presupuestadas primero y tap abre el detalle', () => {
    const onOpenCategory = jest.fn();
    const { getByText, getByLabelText } = render(
      <UnifiedCategories loading={false} budgets={budgets as never} summary={summary as never} onOpenCategory={onOpenCategory} onSeeAll={() => {}} />,
    );
    fireEvent.press(getByLabelText('Ver Transport'));
    expect(onOpenCategory).toHaveBeenCalledWith('TRANSPORT');
    fireEvent.press(getByText('Ver todas ›'));
  });

  it('Ver todas llama onSeeAll y respeta el tope de 6', () => {
    const onSeeAll = jest.fn();
    const many = ['FOOD', 'TRANSPORT', 'GROCERIES', 'SHOPPING', 'CLOTHING', 'ENTERTAINMENT', 'GAMES', 'HEALTH'].map(
      (category, i) => ({ category, currency: 'BOB', total: 10 + i }),
    );
    const { getByText, getAllByLabelText } = render(
      <UnifiedCategories loading={false} budgets={[]} summary={many as never} onOpenCategory={() => {}} onSeeAll={onSeeAll} />,
    );
    // 6 filas (el link "Ver todas las categorías" no cuenta: minúscula)
    expect(getAllByLabelText(/^Ver [A-Z]/)).toHaveLength(6);
    fireEvent.press(getByText('Ver todas ›'));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('vacío muestra empty y cargando muestra loader', () => {
    const { getByText, rerender } = render(
      <UnifiedCategories loading={false} budgets={[]} summary={[]} onOpenCategory={() => {}} onSeeAll={() => {}} />,
    );
    expect(getByText('Sin gastos aún')).toBeTruthy();
    rerender(
      <UnifiedCategories loading budgets={[]} summary={[]} onOpenCategory={() => {}} onSeeAll={() => {}} />,
    );
    expect(getByText('Cargando...')).toBeTruthy();
  });
});
