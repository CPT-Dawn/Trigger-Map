import React, { useRef } from 'react';
import { StyleSheet, Pressable, Animated, Easing } from 'react-native';
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

  const pressProgress = useRef(new Animated.Value(0)).current;

  const scaleValue = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.975],
  });

  const translateY = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const opacityValue = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  const runPressAnimation = (toValue: number, duration: number) => {
    Animated.timing(pressProgress, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    runPressAnimation(1, 90);
  };

  const handlePressOut = () => {
    runPressAnimation(0, 150);
  };

  return (
    <Animated.View
      style={[
        styles.button,
        {
          opacity: opacityValue,
          transform: [{ scale: scaleValue }, { translateY }],
        },
        style as any,
      ]}
    >
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
