import { fireEvent, render } from '@testing-library/react-native';
import { DatePickerModal } from '../DatePickerModal';

const SEP_2026 = '2026-09-06';

describe('DatePickerModal', () => {
  it('muestra el mes de la fecha y el día seleccionado', () => {
    const { getByText, getByLabelText } = render(
      <DatePickerModal visible value={SEP_2026} onClose={() => {}} onSelect={() => {}} />,
    );
    expect(getByText('Seleccionar fecha')).toBeTruthy();
    expect(getByText('Septiembre 2026')).toBeTruthy();
    expect(getByLabelText(`Elegir ${SEP_2026}`)).toBeTruthy();
  });

  it('Hoy selecciona hoy y Aceptar lo confirma', () => {
    const onSelect = jest.fn();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { getByLabelText, getByText } = render(
      <DatePickerModal visible value="2026-01-15" onClose={() => {}} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText('Hoy'));
    fireEvent.press(getByText('Aceptar'));
    expect(onSelect).toHaveBeenCalledWith(iso);
  });

  it('elegir un día y Aceptar devuelve ese YYYY-MM-DD', () => {
    const onSelect = jest.fn();
    const { getByLabelText, getByText } = render(
      <DatePickerModal visible value={SEP_2026} onClose={() => {}} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText('Elegir 2026-09-10'));
    fireEvent.press(getByText('Aceptar'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-10');
  });

  it('Cancelar no llama onSelect', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <DatePickerModal visible value={SEP_2026} onClose={onClose} onSelect={onSelect} />,
    );
    fireEvent.press(getByText('Cancelar'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navega al mes siguiente y anterior', () => {
    const { getByLabelText, getByText, queryByText } = render(
      <DatePickerModal visible value={SEP_2026} onClose={() => {}} onSelect={() => {}} />,
    );
    fireEvent.press(getByLabelText('Mes siguiente'));
    expect(getByText('Octubre 2026')).toBeTruthy();
    expect(queryByText('Septiembre 2026')).toBeNull();
    fireEvent.press(getByLabelText('Mes anterior'));
    expect(getByText('Septiembre 2026')).toBeTruthy();
  });
});
