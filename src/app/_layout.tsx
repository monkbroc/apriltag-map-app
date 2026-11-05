import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useTheme } from '@/components/theme';
import { useLibrary } from '@/state/library';

export default function RootLayout() {
  const t = useTheme();
  const load = useLibrary((s) => s.load);

  useEffect(() => {
    load().catch((e) => console.error('Failed to load tag sets', e));
  }, [load]);

  return (
    <>
      <Stack
        screenOptions={{
          headerTransparent: false,
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'AprilTag Maps' }} />
        <Stack.Screen name="sets/[id]/index" options={{ title: 'Tag set' }} />
        <Stack.Screen name="sets/[id]/edit-tag" options={{ title: 'Edit tag' }} />
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
