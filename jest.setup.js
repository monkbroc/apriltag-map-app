/* global jest */
// Safe-area insets are zero in tests (no native SafeAreaProvider).
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// The map uses Gesture Handler and Reanimated, which need native code; screen tests do not
// exercise it (its geometry is covered by src/core/mapView.test.ts).
jest.mock('@/components/FieldMap', () => ({ FieldMap: () => null }));
