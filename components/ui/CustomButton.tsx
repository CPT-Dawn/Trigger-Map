import React, { useRef } from 'react';
import { StyleSheet, Pressable, Animated } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';
import { Spacing, Radius } from '../../constants/theme';
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
    ? currentColors.primaryContainer
    : isOutlined
      ? currentColors.inputSurface
      : undefined;
  const textColor = isContained
    ? currentColors.onPrimaryContainer
    : isOutlined
      ? currentColors.text
      : currentColors.primary;

  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.96,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  };

  return (
    <Animated.View style={[styles.button, { transform: [{ scale: scaleValue }] }, style as any]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading || props.disabled}
      >
        <Button
          mode={mode}
          loading={isLoading}
          disabled={isLoading || props.disabled}
          buttonColor={buttonColor}
          textColor={textColor}
          style={{
            borderRadius: Radius.xl,
            borderWidth: isContained || isOutlined ? 1 : 0,
            borderColor: isContained ? currentColors.ghostBorder : isOutlined ? currentColors.outlineVariant : undefined,
          }}
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
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    marginVertical: Spacing.xs,
  },
  content: {
    minHeight: 50,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
