import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Snackbar, type SnackbarProps } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Radius } from '../../constants/theme';
import { useAppColors } from '../../providers/ThemeProvider';

export interface AppSnackbarProps extends Omit<SnackbarProps, 'style' | 'theme'> {
  style?: StyleProp<ViewStyle>;
  surfaceColor?: string;
  textColor?: string;
  theme?: SnackbarProps['theme'];
}

export function AppSnackbar({
  visible,
  style,
  surfaceColor,
  textColor,
  theme,
  children,
  ...props
}: AppSnackbarProps) {
  const colors = useAppColors();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 170,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={animatedStyle}>
      <Snackbar
        visible={visible}
        style={[
          styles.snackbar,
          { backgroundColor: surfaceColor ?? colors.surfaceContainerHighest },
          style,
        ]}
        theme={{
          ...theme,
          colors: {
            ...(theme?.colors ?? {}),
            onSurface: textColor ?? colors.text,
          },
        }}
        {...props}
      >
        {children}
      </Snackbar>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    borderRadius: Radius.lg,
  },
});
