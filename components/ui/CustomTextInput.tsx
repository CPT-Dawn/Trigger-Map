import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import type { TextInputProps } from 'react-native-paper';
import { Spacing, Radius, Typography } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export interface CustomTextInputProps extends Omit<TextInputProps, 'theme'> {
  errorMessage?: string;
}

export function CustomTextInput({
  style,
  errorMessage,
  mode = 'outlined',
  ...props
}: CustomTextInputProps) {
  const currentColors = useAppColors();
  const hasError = !!errorMessage;

  return (
    <View style={styles.container}>
      <TextInput
        mode={mode}
        error={hasError}
        style={[styles.input, style]}
        outlineColor={currentColors.outline}
        activeOutlineColor={currentColors.primary}
        textColor={currentColors.text}
        contentStyle={styles.inputContent}
        theme={{
          colors: {
            background: currentColors.surfaceContainerLowest,
            error: currentColors.error,
            primary: currentColors.primary,
            onSurfaceVariant: currentColors.textMuted,
          },
          roundness: Radius.md,
        }}
        {...props}
      />
      {hasError && (
        <Text style={[styles.errorText, { color: currentColors.error, ...Typography.caption }]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  input: {
    minHeight: 52,
    backgroundColor: 'transparent',
  },
  inputContent: {
    ...Typography.body,
  },
  errorText: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});
