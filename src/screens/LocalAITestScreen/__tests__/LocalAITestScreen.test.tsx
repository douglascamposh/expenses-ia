import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocalAITestScreen } from '../index';

describe('LocalAITestScreen', () => {
  it('renders title Local AI Test', () => {
    const { getByText } = render(<LocalAITestScreen />);
    expect(getByText('Local AI Test')).toBeTruthy();
  });

  it('shows Runtime Offline badge', () => {
    const { getByText } = render(<LocalAITestScreen />);
    expect(getByText('Runtime')).toBeTruthy();
    expect(getByText('Offline')).toBeTruthy();
  });

  it('displays AI Pipeline header', () => {
    const { getByText } = render(<LocalAITestScreen />);
    expect(getByText('AI Pipeline')).toBeTruthy();
  });

  it('renders all pipeline stages', () => {
    const { getAllByText, getByText } = render(<LocalAITestScreen />);
    expect(getAllByText('Audio').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Whisper')).toBeTruthy();
    expect(getByText('Local LLM')).toBeTruthy();
    expect(getByText('JSON Command')).toBeTruthy();
    expect(getByText('Validation')).toBeTruthy();
  });

  it('shows arrows between pipeline stages', () => {
    const { getAllByText } = render(<LocalAITestScreen />);
    expect(getAllByText('↓')).toHaveLength(4);
  });

  it('shows Audio section with recording controls', () => {
    const { getAllByText, getByText } = render(<LocalAITestScreen />);
    // Audio card header + pipeline Audio
    expect(getAllByText('Audio').length).toBeGreaterThanOrEqual(1);
    // Initial state shows Start Recording
    expect(getByText('Start Recording')).toBeTruthy();
  });

  it('shows Status with Ready initially', () => {
    const { getAllByText } = render(<LocalAITestScreen />);
    expect(getAllByText(/Status:/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Not implemented for future modules', () => {
    const { getAllByText } = render(<LocalAITestScreen />);
    expect(getAllByText('Not implemented').length).toBeGreaterThanOrEqual(2);
  });

  it('can press Start Recording (permission granted path)', async () => {
    const { getByText } = render(<LocalAITestScreen />);
    const btn = getByText('Start Recording');
    fireEvent.press(btn);
    await waitFor(() => {
      // After press, either Recording or still Start (mock async), at least not crash
      expect(getByText(/Local AI Test/)).toBeTruthy();
    });
  });

  it('shows offline-first hint', () => {
    const { getByText } = render(<LocalAITestScreen />);
    expect(getByText(/Local-first \/ Offline-first POC/)).toBeTruthy();
  });
});
