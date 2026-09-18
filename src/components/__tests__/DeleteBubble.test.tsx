import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DeleteBubble } from '../DeleteBubble';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => (globalThis as { __scheme?: string }).__scheme ?? 'light'),
}));

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

  it('velo claro en light y oscuro en dark', () => {
    const g = globalThis as { __scheme?: string };
    const backdropOf = (r: ReturnType<typeof render>) =>
      StyleSheet.flatten(r.getByLabelText('Cancelar eliminación').props.style) as { backgroundColor: string };
    g.__scheme = 'light';
    const light = render(
      <DeleteBubble visible description="Taxi" onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(backdropOf(light).backgroundColor).toBe('rgba(245,245,244,0.75)');
    light.unmount();
    g.__scheme = 'dark';
    const dark = render(
      <DeleteBubble visible description="Taxi" onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(backdropOf(dark).backgroundColor).toBe('rgba(15,23,42,0.6)');
    dark.unmount();
    delete g.__scheme;
  });
});
