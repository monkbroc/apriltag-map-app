import { ScrollView, StyleSheet, Text } from 'react-native';

import { spacing, useTheme } from '@/components/theme';
import { Screen } from '@/components/ui';

const LICENSES = [
  {
    name: 'AprilTag 3',
    url: 'https://github.com/AprilRobotics/apriltag',
    text: `BSD 2-Clause License

Copyright (C) 2013-2016, The Regents of The University of Michigan.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  },
  {
    name: 'FRC 2026 field layout (WPILib)',
    url: 'https://github.com/wpilibsuite/allwpilib',
    text: 'The built-in FRC 2026 tag set is derived from the WPILib 2026-rebuilt-welded field layout. WPILib is distributed under the BSD 3-Clause license. Copyright (c) 2009-2026 FIRST and other WPILib contributors.',
  },
];

/** In-app licenses (R-7.5). */
export default function LicensesScreen() {
  const t = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={[styles.intro, { color: t.text }]}>
          AprilTag Map builds Limelight .fmap files by scanning a field with your phone.
        </Text>
        {LICENSES.map((l) => (
          <Text key={l.name} style={{ color: t.text }}>
            <Text style={styles.heading}>{l.name}</Text>
            {'\n'}
            <Text style={{ color: t.muted }}>{l.url}</Text>
            {'\n\n'}
            {l.text}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.xl },
  intro: { fontSize: 16 },
  heading: { fontSize: 17, fontWeight: '600' },
});
