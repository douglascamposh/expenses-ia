import { fireEvent, render } from '@testing-library/react-native';
import { SearchDock } from '../SearchDock';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

describe('SearchDock botón IA', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('sin texto muestra ✨ que abre /ai', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByLabelText } = render(
      <SearchDock query="" onChangeQuery={onChange} onSubmit={() => {}} onClose={() => {}} placement="top" />,
    );
    fireEvent.press(getByTestId('home-search-ai'));
    expect(mockPush).toHaveBeenCalledWith('/ai');
    expect(queryByLabelText('Limpiar búsqueda')).toBeNull();
  });

  it('con texto muestra X que limpia', () => {
    const onChange = jest.fn();
    const { getByLabelText, queryByTestId } = render(
      <SearchDock query="hola" onChangeQuery={onChange} onSubmit={() => {}} onClose={() => {}} placement="top" />,
    );
    fireEvent.press(getByLabelText('Limpiar búsqueda'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(queryByTestId('home-search-ai')).toBeNull();
  });
});
