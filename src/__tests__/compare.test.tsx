import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import CompareScreen from '@/app/scan/compare';
import { mat4FromRT, rotationOf, translationOf } from '@/core/math';
import type { TagSet } from '@/core/types';
import { builtinSets } from '@/data/builtinSets';
import { useLibrary } from '@/state/library';
import { useScanSession } from '@/state/scanSession';
import { simulateScan } from '@/testing/simulate';

const mockRouter = { push: jest.fn(), dismissAll: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockSaved: TagSet[] = [];
jest.mock('@/storage/repository', () => ({
  listTagSets: async () => [],
  saveTagSet: async (s: TagSet) => void mockSaved.push(s),
  deleteTagSet: () => {},
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }));

const frc2026 = builtinSets[0]!;
const scanned = frc2026.fiducials.filter((f) => [1, 2, 3, 4].includes(f.id));
const moved = scanned.map((f) =>
  f.id === 2
    ? {
        ...f,
        transform: mat4FromRT(
          rotationOf(f.transform),
          translationOf(f.transform).map((v, i) => (i === 1 ? v + 0.2 : v)) as [
            number,
            number,
            number,
          ],
        ),
      }
    : f,
);

function startScan(referenceId: string) {
  useScanSession.getState().start('refine', referenceId);
  for (const f of simulateScan(moved)) useScanSession.getState().ingestFrame(f);
  useScanSession.getState().toggleExcluded(2);
}

describe('CompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaved.length = 0;
    useLibrary.setState({ userSets: [], loaded: true });
  });

  it('shows per-tag rows and disables Overwrite for a built-in set', async () => {
    startScan(frc2026.id);
    await render(<CompareScreen />);

    expect(screen.getByText('4 updated · 0 new · 28 not scanned')).toBeTruthy();
    expect(
      screen.getByLabelText(/^Tag 2, Updated, moved 20 centimeters.*large change$/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Tag 1, Updated, .*small change$/)).toBeTruthy();
    expect(screen.getByLabelText('Tag 5, Not scanned')).toBeTruthy();
    expect(screen.getByText('Built-in sets cannot be overwritten.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Overwrite' })).toBeDisabled();
  });

  it('saves the refined set as new', async () => {
    startScan(frc2026.id);
    await render(<CompareScreen />);
    await fireEvent.press(screen.getByText('Save as new'));
    const input = screen.getByLabelText('Name the refined tag set');
    expect(input.props.value).toMatch(/^FRC 2026 \(refined \d{4}-\d\d-\d\d\)$/);
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/sets/new-id'));
    expect(mockSaved[0]!.fiducials).toHaveLength(32);
  });

  it('overwrites a user set after confirmation', async () => {
    const userSet: TagSet = { ...frc2026, id: 'mine', name: 'Mine', builtin: undefined };
    useLibrary.setState({ userSets: [userSet] });
    startScan('mine');
    const alert = jest.spyOn(Alert, 'alert');
    await render(<CompareScreen />);
    await fireEvent.press(screen.getByText('Overwrite'));
    const buttons = alert.mock.calls[0]![2]!;
    await buttons.find((b) => b.text === 'Overwrite')!.onPress!();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/sets/mine'));
    expect(mockSaved[0]!.id).toBe('mine');
    const tag2 = mockSaved[0]!.fiducials.find((f) => f.id === 2)!;
    expect(tag2.observationCount).toBe(15);
  });
});
