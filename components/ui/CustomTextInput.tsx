import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import type { TextInputProps } from 'react-native-paper';
import { Spacing, Radius } from '../../constants/theme';
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
        outlineColor={currentColors.ghostBorder}
        activeOutlineColor={currentColors.primary}
        textColor={currentColors.text}
        contentStyle={styles.inputContent}
        theme={{
          colors: {
            background: currentColors.inputSurface,
            error: currentColors.error,
            primary: currentColors.primary,
            onSurfaceVariant: currentColors.textMuted,
          },
          roundness: Radius.xl,
        }}
        {...props}
      />
      {hasError && (
        <Text variant="bodySmall" style={[styles.errorText, { color: currentColors.error }]}>
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
    minHeight: 50,
    backgroundColor: 'transparent',
  },
  inputContent: {},
  errorText: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});
