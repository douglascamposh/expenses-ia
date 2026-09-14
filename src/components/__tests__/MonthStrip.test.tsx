import { fireEvent, render } from '@testing-library/react-native';
import { MonthStrip } from '../MonthStrip';

const TOTALS = [
  { month: '2026-08', currency: 'BOB', total: 100 },
  { month: '2026-09', currency: 'BOB', total: 8244 },
  { month: '2026-10', currency: 'BOB', total: 50 },
];

function renderStrip(overrides: Partial<React.ComponentProps<typeof MonthStrip>> = {}) {
  const onSelectMonth = jest.fn();
  const onSelectYear = jest.fn();
  const tree = render(
    <MonthStrip
      month={8}
      year={2026}
      totals={TOTALS}
      currency="BOB"
      minYear={2026}
      minMonth={8}
      maxYear={2026}
      maxMonth={10}
      onSelectMonth={onSelectMonth}
      onSelectYear={onSelectYear}
      {...overrides}
    />,
  );
  return { tree, onSelectMonth, onSelectYear };
}

describe('MonthStrip', () => {
  it('muestra meses acotados con sus totales', () => {
    const { tree } = renderStrip();
    expect(tree.getByTestId('month-pill-8')).toBeTruthy();
    expect(tree.getByTestId('month-pill-10')).toBeTruthy();
    expect(tree.queryByTestId('month-pill-7')).toBeNull();
    expect(tree.getByText('Bs 8.244')).toBeTruthy();
  });

  it('tap en mes llama onSelectMonth', () => {
    const { tree, onSelectMonth } = renderStrip();
    fireEvent.press(tree.getByTestId('month-pill-10'));
    expect(onSelectMonth).toHaveBeenCalledWith(10);
  });

  it('año mínimo bloquea retroceder y permite avanzar', () => {
    const { tree, onSelectYear } = renderStrip();
    fireEvent.press(tree.getByLabelText('Año anterior'));
    expect(onSelectYear).not.toHaveBeenCalled();
    fireEvent.press(tree.getByLabelText('Año siguiente'));
    expect(onSelectYear).not.toHaveBeenCalled(); // maxYear también es 2026
  });

  it('año intermedio permite ambas flechas', () => {
    const { tree, onSelectYear } = renderStrip({ minYear: 2025, minMonth: 1, maxYear: 2026, maxMonth: 10 });
    fireEvent.press(tree.getByLabelText('Año anterior'));
    expect(onSelectYear).toHaveBeenCalledWith(2025);
  });
});
