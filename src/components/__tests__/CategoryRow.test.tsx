import { fireEvent, render } from '@testing-library/react-native';
import { CategoryRow } from '../CategoryRow';

const swipeRefs = { current: new Map() };
const noop = () => {};

describe('CategoryRow (mockup)', () => {
  it('muestra nombre, píldora de kind e icono; tap edita', () => {
    const onEdit = jest.fn();
    const { getByText, getByLabelText } = render(
      <CategoryRow
        item={{ id: 'COMPRAS', label: 'Compras', emoji: '🛍', color: '#ec4899', kind: 'GASTO' }}
        onEdit={onEdit}
        onTrashPress={() => {}}
        swipeRefs={swipeRefs}
        onOpen={noop}
      />,
    );
    expect(getByText('Compras')).toBeTruthy();
    expect(getByText('Gasto')).toBeTruthy();
    expect(getByText('🛍')).toBeTruthy();
    fireEvent.press(getByLabelText('Editar Compras'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('fila bloqueada muestra hint y no es presionable', () => {
    const onEdit = jest.fn();
    const { getByText, queryByLabelText } = render(
      <CategoryRow
        item={{ id: 'OTHER', label: 'Otros', emoji: '📦', color: '#a1a1aa', kind: 'GASTO' }}
        hint="Sistema"
        swipeRefs={swipeRefs}
        onOpen={noop}
      />,
    );
    expect(getByText('Sistema')).toBeTruthy();
    expect(queryByLabelText('Editar Otros')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
