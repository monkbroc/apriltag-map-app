import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/components/theme';
import { Button, PromptDialog, Screen } from '@/components/ui';
import { parseFmap, type ParseResult } from '@/core/fmap';
import { nameError, uniqueName, useLibrary } from '@/state/library';

interface Picked {
  fileName: string;
  result: ParseResult;
}

/** Read the picked file. Exported so tests can swap the platform picker. */
export async function pickFmapFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  return { name: asset.name, text: await new File(asset.uri).text() };
}

/** Import an .fmap: pick, validate, preview, name, save (R-5.9.2). */
export default function ImportScreen({ pick = pickFmapFile }: { pick?: typeof pickFmapFile }) {
  const t = useTheme();
  const router = useRouter();
  const { userSets, create } = useLibrary();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setBusy(true);
    try {
      const file = await pick();
      if (file) setPicked({ fileName: file.name, result: parseFmap(file.text) });
    } catch (e) {
      setPicked({
        fileName: 'file',
        result: { ok: false, errors: [`Could not read the file: ${String(e)}`] },
      });
    } finally {
      setBusy(false);
    }
  };

  const baseName = picked?.fileName.replace(/\.(fmap|json)$/i, '') ?? '';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={{ color: t.muted }}>
          Pick a Limelight .fmap (or .json) file. Only &quot;frc&quot; maps using the
          apriltag3_36h11_classic family can be imported.
        </Text>
        <Button
          title={picked ? 'Choose another file' : 'Choose file'}
          disabled={busy}
          onPress={choose}
        />
        {picked?.result.ok === false ? (
          <View
            accessibilityRole="alert"
            style={[styles.box, { borderColor: t.danger, backgroundColor: t.surface }]}
          >
            <Text style={[styles.title, { color: t.danger }]}>
              ✕ {picked.fileName} can&apos;t be imported
            </Text>
            {picked.result.errors.map((e) => (
              <Text key={e} style={{ color: t.text }}>
                • {e}
              </Text>
            ))}
          </View>
        ) : null}
        {picked?.result.ok ? (
          <View style={[styles.box, { borderColor: t.green, backgroundColor: t.surface }]}>
            <Text style={[styles.title, { color: t.green }]}>✓ {picked.fileName} is valid</Text>
            <Text style={{ color: t.text }}>
              {picked.result.doc.fiducials.length} tags: IDs{' '}
              {picked.result.doc.fiducials.map((f) => f.id).join(', ') || 'none'}
            </Text>
            <Button title="Import…" onPress={() => setNaming(true)} />
          </View>
        ) : null}
      </ScrollView>
      <PromptDialog
        visible={naming}
        title="Name the imported tag set"
        initialValue={uniqueName(baseName || 'Imported map', userSets)}
        confirmLabel="Import"
        validate={(v) => nameError(v, userSets)}
        onCancel={() => setNaming(false)}
        onSubmit={async (name) => {
          if (!picked?.result.ok) return;
          const set = await create(name, picked.result.doc.fiducials);
          setNaming(false);
          router.replace(`/sets/${set.id}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg },
  box: { borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  title: { fontWeight: '600', fontSize: 16 },
});
