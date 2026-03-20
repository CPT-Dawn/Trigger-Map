import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type AuthFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
};

export function AuthField({ label, ...inputProps }: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const focusBorder = theme === 'dark' ? 'rgba(186, 195, 255, 0.42)' : 'rgba(3, 22, 50, 0.22)';

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.outline}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceContainerHighest,
            color: colors.text,
            borderColor: focused ? focusBorder : 'transparent',
          },
        ]}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        {...inputProps}
      />
    </View>
  );
}

type AuthPrimaryButtonProps = {
  title: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function AuthPrimaryButton({ title, disabled = false, loading = false, onPress }: AuthPrimaryButtonProps) {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.primaryOuter,
        { shadowColor: colors.primaryContainer },
        (disabled || loading) && styles.primaryDisabled,
      ]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.primaryGradient}>
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

type AuthSocialButtonProps = {
  iconName: IconName;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function AuthSocialButton({
  iconName,
  label,
  disabled = false,
  loading = false,
  onPress,
}: AuthSocialButtonProps) {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.socialButton,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.ghostBorder,
        },
        (disabled || loading) && styles.socialDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          <Ionicons color={colors.text} name={iconName} size={18} />
          <Text style={[styles.socialText, { color: colors.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

type AuthDividerProps = {
  label: string;
};

export function AuthDivider({ label }: AuthDividerProps) {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  return (
    <View style={styles.dividerWrap}>
      <View style={[styles.dividerLine, { backgroundColor: colors.ghostBorder }]} />
      <Text style={[styles.dividerText, { color: colors.outline }]}>{label}</Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.ghostBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  input: {
    borderRadius: 18,
    borderWidth: 2,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryOuter: {
    borderRadius: 999,
    marginTop: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryGradient: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '800',
  },
  primaryDisabled: {
    opacity: 0.62,
  },
  socialButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '700',
  },
  socialDisabled: {
    opacity: 0.62,
  },
  dividerWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
