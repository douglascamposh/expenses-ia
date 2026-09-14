import { fireEvent, render } from '@testing-library/react-native';
import { BudgetCategoryRow } from '../BudgetCategoryRow';

const base = {
  currency: 'BOB' as const,
  expanded: false,
  onToggle: () => {},
  onSave: () => {},
  onTrashPress: () => {},
  swipeRefs: { current: new Map() } as never,
  onOpen: () => {},
};

const COMIDA = { id: 'COMIDA', label: 'Comida', icon: 'x', emoji: '🍔', color: '#ef4444', kind: 'GASTO' } as never;
const COMIDA_PROGRESS = { category: 'COMIDA', currency: 'BOB', limit: 200, spent: 120, pct: 0.6, over: false } as never;

describe('BudgetCategoryRow', () => {
  it('con budget muestra monto y expande editor precargado', () => {
    const onToggle = jest.fn();
    const { getByText, getByLabelText, getByTestId, rerender } = render(
      <BudgetCategoryRow
        {...base}
        config={COMIDA}
        progress={COMIDA_PROGRESS}
        onToggle={onToggle}
      />,
    );
    expect(getByText('BOB 200')).toBeTruthy();
    fireEvent.press(getByLabelText('Presupuesto Comida'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <BudgetCategoryRow
        {...base}
        config={COMIDA}
        progress={COMIDA_PROGRESS}
        expanded
        onToggle={onToggle}
      />,
    );
    expect(getByTestId('budget-amount-COMIDA').props.value).toBe('200');
  });

  it('sin budget muestra "sin presupuesto" y guarda el monto nuevo', () => {
    const onSave = jest.fn();
    const { getByText, getByLabelText, getByTestId } = render(
      <BudgetCategoryRow {...base} config={COMIDA} progress={null} expanded onSave={onSave} />,
    );
    expect(getByText('Sin presupuesto establecido')).toBeTruthy();
    fireEvent.changeText(getByTestId('budget-amount-COMIDA'), '500');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    expect(onSave).toHaveBeenCalledWith(500);
  });

  it('swipe en fila con budget revela papelera que elimina', () => {
    const onTrashPress = jest.fn();
    const tree = render(
      <BudgetCategoryRow
        {...base}
        config={COMIDA}
        progress={COMIDA_PROGRESS}
        onTrashPress={onTrashPress}
      />,
    );
    // El Swipeable monta las acciones: la papelera está en el árbol
    fireEvent.press(tree.getByLabelText('Eliminar presupuesto Comida'));
    expect(onTrashPress).toHaveBeenCalledWith('COMIDA');
  });

  it('fila sin budget no tiene papelera', () => {
    const tree = render(
      <BudgetCategoryRow {...base} config={COMIDA} progress={null} />,
    );
    expect(tree.queryByLabelText('Eliminar presupuesto Comida')).toBeNull();
  });
});
