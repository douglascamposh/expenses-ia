import { fireEvent, render } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast', () => {
  it('oculto no renderiza', () => {
    const { queryByText } = render(<Toast visible={false} message="Hola" onDismiss={() => {}} />);
    expect(queryByText('Hola')).toBeNull();
  });

  it('visible muestra el mensaje y se descarta al tocar', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(<Toast visible message="Falta algo" onDismiss={onDismiss} />);
    expect(getByText('Falta algo')).toBeTruthy();
    fireEvent.press(getByText('Falta algo'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-cierre con timers', () => {
    jest.useFakeTimers();
    try {
      const onDismiss = jest.fn();
      render(<Toast visible message="Hola" durationMs={1000} onDismiss={onDismiss} />);
      jest.advanceTimersByTime(1000);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
