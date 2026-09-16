import { render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { FrostedDock } from '../FrostedDock';

const mockScheme = jest.fn<'light' | 'dark', []>(() => 'light');
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockScheme(),
}));

describe('FrostedDock', () => {
  beforeEach(() => {
    mockScheme.mockReturnValue('light');
  });

  it('renderiza sin crash (blur + fade tras los flotantes)', () => {
    const { toJSON } = render(<FrostedDock />);
    expect(toJSON()).toBeTruthy();
  });

  it('usa tint light en modo claro', () => {
    const { UNSAFE_getByType } = render(<FrostedDock />);
    expect(UNSAFE_getByType(BlurView).props.tint).toBe('light');
  });

  it('usa tint dark en modo oscuro (el degradado no se ve blanco)', () => {
    mockScheme.mockReturnValue('dark');
    const { UNSAFE_getByType } = render(<FrostedDock />);
    expect(UNSAFE_getByType(BlurView).props.tint).toBe('dark');
  });
});
