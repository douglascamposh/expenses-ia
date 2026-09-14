import { fireEvent, render } from '@testing-library/react-native';
import { CurrencyModal } from '../CurrencyModal';

describe('CurrencyModal (mockup Moneda)', () => {
  it('filtra por nombre o país y selecciona', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText, getByLabelText, queryByText } = render(
      <CurrencyModal visible selected="BOB" onClose={() => {}} onSelect={onSelect} />,
    );
    expect(getByText('Moneda')).toBeTruthy();
    fireEvent.changeText(getByTestId('currency-search-input'), 'bol');
    // BOB por código/nombre; USD no matchea
    expect(getByText('boliviano')).toBeTruthy();
    expect(queryByText('dólar estadounidense')).toBeNull();
    fireEvent.press(getByLabelText('Usar BOB'));
    expect(onSelect).toHaveBeenCalledWith('BOB');
  });

  it('busca por país y muestra símbolo home + código', () => {
    const { getByTestId, getByText, queryByText } = render(
      <CurrencyModal visible selected="USD" onClose={() => {}} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByTestId('currency-search-input'), 'mexico');
    expect(getByText('peso mexicano')).toBeTruthy();
    expect(getByText('México · MXN')).toBeTruthy();
    expect(queryByText('boliviano')).toBeNull();
  });

  it('busca sin tildes (dolar → dólar)', () => {
    const { getByTestId, getByText, queryByText } = render(
      <CurrencyModal visible selected="BOB" onClose={() => {}} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByTestId('currency-search-input'), 'dolar');
    expect(getByText('dólar estadounidense')).toBeTruthy();
    expect(queryByText('boliviano')).toBeNull();
  });

  it('sin resultados muestra vacío y la X cierra', () => {
    const onClose = jest.fn();
    const { getByTestId, getByText, getAllByLabelText } = render(
      <CurrencyModal visible selected="BOB" onClose={onClose} onSelect={() => {}} />,
    );
    fireEvent.changeText(getByTestId('currency-search-input'), 'zzz');
    expect(getByText('Sin resultados')).toBeTruthy();
    const closers = getAllByLabelText('Cerrar');
    fireEvent.press(closers[closers.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
