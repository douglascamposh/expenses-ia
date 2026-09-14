import { render } from '@testing-library/react-native';
import { FrostedDock } from '../FrostedDock';

describe('FrostedDock', () => {
  it('renderiza sin crash (blur + fade tras los flotantes)', () => {
    const { toJSON } = render(<FrostedDock />);
    expect(toJSON()).toBeTruthy();
  });
});
