import { fireEvent, render } from '@testing-library/react-native';
import { DeleteBubble } from '../DeleteBubble';

describe('DeleteBubble (confirmar eliminación)', () => {
  it('oculto no renderiza nada', () => {
    const { queryByLabelText } = render(
      <DeleteBubble visible={false} description="Taxi" onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(queryByLabelText('Confirmar eliminación')).toBeNull();
  });

  it('visible muestra mensaje y confirma', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <DeleteBubble visible description="Taxi" onCancel={jest.fn()} onConfirm={onConfirm} />,
    );
    expect(getByText(/Taxi/)).toBeTruthy();
    fireEvent.press(getByLabelText('Confirmar eliminación'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('backdrop cancela', () => {
    const onCancel = jest.fn();
    const { getByLabelText } = render(
      <DeleteBubble visible description="" onCancel={onCancel} onConfirm={jest.fn()} />,
    );
    fireEvent.press(getByLabelText('Cancelar eliminación'));
    expect(onCancel).toHaveBeenCalled();
  });
});
