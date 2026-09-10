import { fireEvent, render } from '@testing-library/react-native';
import { CurrencyModal } from '../CurrencyModal';
import { SUPPORTED_CURRENCIES } from '@/expenses/models/Expense';

describe('CurrencyModal', () => {
  it('lista todas las monedas y marca la seleccionada', () => {
    const { getByText, getByLabelText } = render(
      <CurrencyModal visible selected="BOB" onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByText('Moneda por defecto')).toBeTruthy();
    for (const cur of SUPPORTED_CURRENCIES) {
      expect(getByLabelText(`Usar ${cur}`)).toBeTruthy();
    }
  });

  it('elegir llama onSelect con la moneda', () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <CurrencyModal visible selected="BOB" onClose={() => {}} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText('Usar PEN'));
    expect(onSelect).toHaveBeenCalledWith('PEN');
  });
});
