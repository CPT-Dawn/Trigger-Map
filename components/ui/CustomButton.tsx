import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';
import { Spacing, Radius, Typography } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

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
  const currentColors = useAppColors();

  const isContained = mode === 'contained';
  const isOutlined = mode === 'outlined';
  const buttonColor = isContained
    ? currentColors.primary
    : isOutlined
      ? currentColors.surfaceContainer
      : undefined;
  const textColor = isContained
    ? currentColors.onPrimary
    : isOutlined
      ? currentColors.text
      : currentColors.primary;

  return (
    <Button
      mode={mode}
      loading={isLoading}
      disabled={isLoading || props.disabled}
      buttonColor={buttonColor}
      textColor={textColor}
      style={[
        styles.button,
        {
          borderRadius: Radius.xl,
          borderColor: isOutlined ? currentColors.outlineVariant : undefined,
        },
        style,
      ]}
      contentStyle={[
        styles.content,
        { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
        contentStyle,
      ]}
      labelStyle={[styles.label, props.labelStyle]}
      theme={{
        colors: {
          surfaceDisabled: currentColors.surfaceContainerHigh,
          onSurfaceDisabled: currentColors.textMuted,
        },
      }}
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
    minHeight: 52,
  },
  label: {
    ...Typography.body,
    fontWeight: '700',
  },
});
