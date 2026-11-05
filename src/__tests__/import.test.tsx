import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { serializeFmap } from '@/core/fmap';
import { builtinSets } from '@/data/builtinSets';
import { useLibrary } from '@/state/library';

import ImportScreen from '@/app/import';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockSaved: unknown[] = [];
jest.mock('@/storage/repository', () => ({
  listTagSets: async () => [],
  saveTagSet: async (s: unknown) => void mockSaved.push(s),
  deleteTagSet: () => {},
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

const validText = serializeFmap(builtinSets[0]!.fiducials.slice(0, 3));

describe('ImportScreen', () => {
  beforeEach(() => {
    mockSaved.length = 0;
    mockReplace.mockClear();
    useLibrary.setState({ userSets: [], loaded: true });
  });

  it('previews a valid file and saves it under the chosen name', async () => {
    await render(<ImportScreen pick={async () => ({ name: 'practice.fmap', text: validText })} />);
    await fireEvent.press(screen.getByText('Choose file'));
    expect(await screen.findByText('✓ practice.fmap is valid')).toBeTruthy();
    expect(screen.getByText('3 tags: IDs 1, 2, 3')).toBeTruthy();

    await fireEvent.press(screen.getByText('Import…'));
    const input = screen.getByLabelText('Name the imported tag set');
    expect(input.props.value).toBe('practice');
    await fireEvent.press(screen.getByText('Import'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/sets/uuid-1'));
    expect(mockSaved).toHaveLength(1);
    expect(useLibrary.getState().userSets[0]).toMatchObject({ name: 'practice', id: 'uuid-1' });
    expect(useLibrary.getState().userSets[0]!.fiducials).toHaveLength(3);
  });

  it('shows every validation error for an invalid file', async () => {
    const bad = JSON.stringify({
      type: 'ftc',
      fiducials: [
        {
          family: 'tag16h5',
          id: 1,
          size: 165.1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          unique: 1,
        },
      ],
    });
    await render(<ImportScreen pick={async () => ({ name: 'bad.fmap', text: bad })} />);
    await fireEvent.press(screen.getByText('Choose file'));
    expect(await screen.findByText("✕ bad.fmap can't be imported")).toBeTruthy();
    expect(screen.getByText(/Map type "ftc" is not supported/)).toBeTruthy();
    expect(screen.getByText(/Tag 1: family "tag16h5"/)).toBeTruthy();
    expect(screen.queryByText('Import…')).toBeNull();
  });

  it('does nothing when the picker is cancelled', async () => {
    await render(<ImportScreen pick={async () => null} />);
    await fireEvent.press(screen.getByText('Choose file'));
    await waitFor(() => expect(screen.getByText('Choose file')).toBeTruthy());
    expect(screen.queryByText(/is valid|can't be imported/)).toBeNull();
  });
});
