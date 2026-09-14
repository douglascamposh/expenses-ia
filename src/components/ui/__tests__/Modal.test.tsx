import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { Modal } from '../Modal';

describe('Modal backdrop (hermanos, sin bubbling)', () => {
  it('tocar fuera cierra; tocar dentro nunca cierra', () => {
    const onDismiss = jest.fn();
    const onInner = jest.fn();
    const { getByLabelText } = render(
      <Modal visible variant="center" onDismiss={onDismiss}>
        <Pressable accessibilityLabel="Adentro" onPress={onInner}>
          <Text>Hola</Text>
        </Pressable>
      </Modal>,
    );
    // Toque interior: solo el handler interior, jamás onDismiss
    fireEvent.press(getByLabelText('Adentro'));
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    // Toque en el fondo: cierra
    fireEvent.press(getByLabelText('Cerrar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('sin dismissOnOverlayPress no hay backdrop tocable', () => {
    const { queryByLabelText } = render(
      <Modal visible variant="center" dismissOnOverlayPress={false} onDismiss={() => {}}>
        <Text>Hola</Text>
      </Modal>,
    );
    expect(queryByLabelText('Cerrar')).toBeNull();
  });
});
