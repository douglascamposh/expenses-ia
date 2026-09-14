import { fireEvent, render } from '@testing-library/react-native';
import { CategoryModal } from '../CategoryModal';
import {
  SYSTEM_CATEGORY,
  setCustomCategories,
  type CategoryConfig,
} from '@/expenses/categories/expenseCategories';

const CUSTOMS: CategoryConfig[] = [
  { id: 'COMIDA' as CategoryConfig['id'], label: 'Comida', icon: 'fork.knife', emoji: '🍔', color: '#f97316', kind: 'GASTO' },
  { id: 'SALARIO' as CategoryConfig['id'], label: 'Salario', icon: 'dollarsign.circle.fill', emoji: '💰', color: '#10b981', kind: 'INGRESO' },
];

afterEach(() => {
  setCustomCategories([]);
});

describe('CategoryModal (categorías del usuario)', () => {
  it('lista las del usuario más la del sistema y marca la seleccionada', () => {
    setCustomCategories(CUSTOMS);
    const { getByLabelText } = render(
      <CategoryModal visible selected="COMIDA" onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByLabelText('Elegir Comida')).toBeTruthy();
    expect(getByLabelText('Elegir Salario')).toBeTruthy();
    expect(getByLabelText(`Elegir ${SYSTEM_CATEGORY.label}`)).toBeTruthy();
  });

  it('sin customs solo lista la del sistema', () => {
    const { getByLabelText, queryByLabelText } = render(
      <CategoryModal visible selected={SYSTEM_CATEGORY.id} onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByLabelText(`Elegir ${SYSTEM_CATEGORY.label}`)).toBeTruthy();
    expect(queryByLabelText('Elegir Comida')).toBeNull();
  });

  it('elegir llama onSelect con el id', () => {
    setCustomCategories(CUSTOMS);
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <CategoryModal visible selected="COMIDA" onClose={() => {}} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText(`Elegir ${SYSTEM_CATEGORY.label}`));
    expect(onSelect).toHaveBeenCalledWith(SYSTEM_CATEGORY.id);
  });

  it('kindFilter muestra solo las de ese kind más la del sistema', () => {
    setCustomCategories(CUSTOMS);
    const { queryByLabelText, getByLabelText } = render(
      <CategoryModal visible selected="SALARIO" kindFilter="INGRESO" onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByLabelText('Elegir Salario')).toBeTruthy();
    expect(getByLabelText(`Elegir ${SYSTEM_CATEGORY.label}`)).toBeTruthy();
    expect(queryByLabelText('Elegir Comida')).toBeNull();
  });
});
