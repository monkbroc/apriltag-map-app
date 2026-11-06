/* global jest */
// Safe-area insets are zero in tests (no native SafeAreaProvider).
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
