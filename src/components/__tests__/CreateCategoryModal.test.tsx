import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CreateCategoryModal } from '../CreateCategoryModal';

const mockDispatch = jest.fn(() => ({ unwrap: () => Promise.resolve([]) }));
jest.mock('@/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

describe('CreateCategoryModal (lenguaje agregar-gasto)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('paleta en carrusel de una fila con pasteles y guarda el elegido', async () => {
    const onSaved = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <CreateCategoryModal visible saving={false} onClose={() => {}} onSaved={onSaved} />,
    );
    // 24 colores (14 base + 10 pasteles) con scroll horizontal
    expect(getByLabelText('Color #FBCFE8')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('Mascotas'), 'Pastel');
    fireEvent.press(getByLabelText('Color #FBCFE8'));
    fireEvent.press(getByLabelText('Guardar'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Pastel'));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
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
