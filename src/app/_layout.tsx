import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'AprilTag Maps' }} />
        <Stack.Screen name="sets/[id]/index" options={{ title: 'Tag set' }} />
        <Stack.Screen
          name="sets/[id]/edit-tag"
          options={{ title: 'Edit tag', presentation: 'modal' }}
        />
        <Stack.Screen name="scan/new" options={{ title: 'New scan' }} />
        <Stack.Screen name="scan/session" options={{ title: 'Scanning', headerShown: false }} />
        <Stack.Screen name="scan/align" options={{ title: 'Align to field' }} />
        <Stack.Screen name="scan/compare" options={{ title: 'Compare' }} />
        <Stack.Screen name="scan/review" options={{ title: 'Review scan' }} />
        <Stack.Screen name="import" options={{ title: 'Import .fmap' }} />
        <Stack.Screen name="licenses" options={{ title: 'Licenses' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
