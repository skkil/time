import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HELD } from '@/ui/surfaces';
import { spacing, type } from '@/ui/theme';

/** A labelled run of rows; `held` puts them on glass, otherwise they sit on the sky. */
export function Group({
  title,
  children,
  trailing,
  held = false,
}: {
  title?: string;
  children: ReactNode;
  trailing?: string;
  held?: boolean;
}) {
  return (
    <View style={styles.group}>
      {title && (
        <View style={styles.heading}>
          <Text style={type.small}>{title}</Text>
          {trailing && <Text style={type.small}>{trailing}</Text>}
        </View>
      )}
      <View style={held && [HELD, styles.held]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  heading: { flexDirection: 'row', justifyContent: 'space-between' },
  held: { overflow: 'hidden' },
});
