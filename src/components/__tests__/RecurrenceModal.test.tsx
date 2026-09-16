import { fireEvent, render } from '@testing-library/react-native';
import { RecurrenceModal } from '../RecurrenceModal';

describe('RecurrenceModal', () => {
  it('lista las 8 frecuencias y selecciona', () => {
    const onSelect = jest.fn();
    const { getByText, getByLabelText } = render(
      <RecurrenceModal visible selected="ONCE" onClose={() => {}} onSelect={onSelect} />,
    );
    expect(getByText('Repetir')).toBeTruthy();
    for (const label of ['Una vez', 'Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Bimensual', 'Trimestral', 'Anual']) {
      expect(getByText(label)).toBeTruthy();
    }
    fireEvent.press(getByLabelText('Mensual'));
    expect(onSelect).toHaveBeenCalledWith('MONTHLY');
  });
});
