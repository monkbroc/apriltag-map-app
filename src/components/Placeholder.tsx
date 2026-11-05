import { StyleSheet, Text, View } from 'react-native';

export function Placeholder({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
