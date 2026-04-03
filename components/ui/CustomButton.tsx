import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';
import { resolveColors, Spacing, Radius } from '../../constants/theme';
import { useColorScheme } from 'react-native';

export interface CustomButtonProps extends Omit<ButtonProps, 'theme'> {
  isLoading?: boolean;
}

export function CustomButton({
  mode = 'contained',
  isLoading = false,
  style,
  contentStyle,
  children,
  ...props
}: CustomButtonProps) {
  const currentColors = resolveColors(useColorScheme());

  // We map standard modes to our custom semantic colors
  const buttonColor = mode === 'contained' ? currentColors.primary : undefined;
  const textColor = mode === 'contained' ? currentColors.onPrimary : currentColors.primary;

  return (
    <Button
      mode={mode}
      loading={isLoading}
      disabled={isLoading || props.disabled}
      buttonColor={buttonColor}
      textColor={textColor}
      style={[styles.button, { borderRadius: Radius.md }, style]}
      contentStyle={[
        styles.content,
        { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
        contentStyle,
      ]}
      labelStyle={[styles.label, props.labelStyle]}
      {...props}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginVertical: Spacing.xs,
  },
  content: {
    minHeight: 48, // Android Material 3 minimum touch target
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0,
  },
});
