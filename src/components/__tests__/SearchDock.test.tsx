import { fireEvent, render } from '@testing-library/react-native';
import { SearchDock } from '../SearchDock';

describe('SearchDock', () => {
  it('bottom: input + X que limpia y cierra', () => {
    const onChangeQuery = jest.fn();
    const onClose = jest.fn();
    const tree = render(
      <SearchDock placement="bottom" query="pan" onChangeQuery={onChangeQuery} onSubmit={() => {}} onClose={onClose} />,
    );
    const input = tree.getByTestId('home-search-input');
    expect(input.props.value).toBe('pan');
    fireEvent.changeText(input, 'pan casero');
    expect(onChangeQuery).toHaveBeenCalledWith('pan casero');
    fireEvent.press(tree.getByTestId('home-search-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('top: misma interfaz en flujo', () => {
    const onSubmit = jest.fn();
    const tree = render(
      <SearchDock placement="top" query="" onChangeQuery={() => {}} onSubmit={onSubmit} onClose={() => {}} />,
    );
    fireEvent(tree.getByTestId('home-search-input'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
