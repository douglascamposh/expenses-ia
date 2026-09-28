import { fireEvent, render } from '@testing-library/react-native';

import { formatSpentPct, spentFraction, SpentRingCard } from '../SpentRingCard';

describe('SpentRingCard logic', () => {
  it('pct = gasto / ingreso', () => {
    expect(spentFraction(1039, 11683)).toBeCloseTo(0.0889, 3);
    expect(formatSpentPct(1039 / 11683)).toBe('8.9%');
  });

  it('sin ingreso y con gasto: círculo rojo completo', () => {
    expect(spentFraction(500, 0)).toBe(1);
    expect(formatSpentPct(1)).toBe('100%');
  });

  it('sin ingreso ni gasto: 0%', () => {
    expect(spentFraction(0, 0)).toBe(0);
    expect(formatSpentPct(0)).toBe('0%');
  });

  it('gasto mayor al ingreso: supera el 100%', () => {
    expect(spentFraction(1500, 1000)).toBe(1.5);
    expect(formatSpentPct(1.5)).toBe('150%');
  });
});

describe('SpentRingCard render', () => {
  it('con ingreso: 2 píldoras + porcentaje', () => {
    const { getByTestId, getByText } = render(
      <SpentRingCard expense={1039} income={11683} currencySymbol="Bs" mode="net" onSelectMode={() => {}} />,
    );
    expect(getByTestId('spent-income-pill')).toBeTruthy();
    expect(getByTestId('spent-expense-pill')).toBeTruthy();
    expect(getByText('8.9%')).toBeTruthy();
    expect(getByText('11.683 Bs')).toBeTruthy();
    expect(getByText('1.039 Bs')).toBeTruthy();
  });

  it('sin ingreso: solo píldora de gasto, sin porcentaje', () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = render(
      <SpentRingCard expense={500} income={0} currencySymbol="Bs" mode="net" onSelectMode={() => {}} />,
    );
    expect(getByTestId('spent-ring-card')).toBeTruthy();
    expect(getByTestId('spent-expense-pill')).toBeTruthy();
    expect(queryByTestId('spent-income-pill')).toBeNull();
    expect(queryByText(/%/)).toBeNull();
    expect(getByText('500 Bs')).toBeTruthy();
  });

  it('tocar una píldora avisa el filtro', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <SpentRingCard expense={100} income={1000} currencySymbol="Bs" mode="net" onSelectMode={onSelect} />,
    );
    fireEvent.press(getByTestId('spent-expense-pill'));
    expect(onSelect).toHaveBeenCalledWith('exp');
    fireEvent.press(getByTestId('spent-income-pill'));
    expect(onSelect).toHaveBeenCalledWith('inc');
  });
});
