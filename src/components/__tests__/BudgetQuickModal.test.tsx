import { fireEvent, render } from '@testing-library/react-native';

import { BudgetQuickModal } from '../BudgetQuickModal';
import { setCustomCategories } from '@/expenses/categories/expenseCategories';

const COMPRAS = {
  id: 'COMPRAS',
  label: 'Compras',
  icon: 'bag.fill',
  emoji: '🛍',
  color: '#ef4444',
  kind: 'GASTO',
} as never;

function renderModal(props?: Partial<React.ComponentProps<typeof BudgetQuickModal>>) {
  return render(
    <BudgetQuickModal
      visible
      categoryId="COMPRAS"
      currency="BOB"
      currentLimit={null}
      saving={false}
      onClose={() => {}}
      onSave={() => {}}
      {...props}
    />,
  );
}

describe('BudgetQuickModal', () => {
  beforeEach(() => {
    setCustomCategories([COMPRAS]);
  });
  afterEach(() => {
    setCustomCategories([]);
  });

  it('muestra la categoría y precarga el límite actual', () => {
    const { getByText, getByTestId } = renderModal({ currentLimit: 400 });
    expect(getByText(/Compras/)).toBeTruthy();
    expect(getByTestId('budget-quick-amount-COMPRAS').props.value).toBe('400');
  });

  it('monto inválido muestra error y no guarda', () => {
    const onSave = jest.fn();
    const { getByTestId, getByText, getByLabelText } = renderModal({ onSave });
    fireEvent.changeText(getByTestId('budget-quick-amount-COMPRAS'), '0');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    expect(getByText(/mayor a 0/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('monto válido guarda', () => {
    const onSave = jest.fn();
    const { getByTestId, getByLabelText } = renderModal({ onSave });
    fireEvent.changeText(getByTestId('budget-quick-amount-COMPRAS'), '350');
    fireEvent.press(getByLabelText('Guardar presupuesto'));
    expect(onSave).toHaveBeenCalledWith(350);
  });
});
