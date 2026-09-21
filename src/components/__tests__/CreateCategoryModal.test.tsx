import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CreateCategoryModal } from '../CreateCategoryModal';
import { setCustomCategories } from '@/expenses/categories/expenseCategories';

const PASTEL = { id: 'PASTEL', label: 'Pastel', icon: 'shippingbox.fill', emoji: '📦', color: '#FBCFE8', kind: 'GASTO' };

const mockDispatch: jest.Mock = jest.fn(() => ({
  unwrap: () => Promise.resolve([]),
}));
jest.mock('@/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

describe('CreateCategoryModal (lenguaje agregar-gasto)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('paleta en carrusel de una fila con pasteles y guarda el elegido', async () => {
    const onSaved = jest.fn();
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <CreateCategoryModal visible saving={false} onClose={() => {}} onSaved={onSaved} />,
    );
    // Label del nombre y Guardar dentro del botón (píldora, no círculo + texto fuera)
    expect(getByText('Nombre de la categoría')).toBeTruthy();
    const saveBtn = getByLabelText('Guardar');
    expect(getByText('Guardar')).toBeTruthy();
    const flatStyle = [saveBtn.props.style].flat(Infinity);
    expect(flatStyle).toContainEqual(expect.objectContaining({ flexDirection: 'row' }));
    expect(flatStyle).not.toContainEqual(expect.objectContaining({ width: 56 }));
    // 24 colores (14 base + 10 pasteles) con scroll horizontal
    expect(getByLabelText('Color #FBCFE8')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('Compras'), 'Pastel');
    fireEvent.press(getByLabelText('Color #FBCFE8'));
    mockDispatch.mockImplementationOnce(() => ({ unwrap: () => Promise.resolve([PASTEL]) }));
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'PASTEL', label: 'Pastel', kind: 'GASTO' }),
    ));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('usa el registro como respaldo si el payload no trae la creada', async () => {
    setCustomCategories([PASTEL] as never);
    try {
      const onSaved = jest.fn();
      const { getByPlaceholderText, getByLabelText } = render(
        <CreateCategoryModal visible saving={false} onClose={() => {}} onSaved={onSaved} />,
      );
      fireEvent.changeText(getByPlaceholderText('Compras'), 'Pastel');
      fireEvent.press(getByLabelText('Guardar'));
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PASTEL', label: 'Pastel', kind: 'GASTO' }),
      ));
    } finally {
      setCustomCategories([]);
    }
  });

  it('X cierra sin guardar', () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const { getAllByLabelText } = render(
      <CreateCategoryModal visible saving={false} onClose={onClose} onSaved={onSaved} />,
    );
    // [0] = backdrop, [último] = botón X
    const closers = getAllByLabelText('Cerrar');
    fireEvent.press(closers[closers.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('kindPreset preselecciona ingreso', () => {
    const { getByLabelText } = render(
      <CreateCategoryModal visible saving={false} kindPreset="INGRESO" onClose={() => {}} onSaved={() => {}} />,
    );
    expect(getByLabelText('Categoría de ingreso')).toBeTruthy();
  });
});
