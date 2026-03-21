import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SmartDropdown } from '@/components/dropdowns/smart-dropdown';
import { Colors } from '@/constants/theme';
import { DROPDOWN_CATEGORY_DEFINITIONS, type DropdownCategoryKey, type DropdownOption } from '@/lib/dropdowns';
import { useAppTheme } from '@/lib/theme';

type SelectionState = Record<DropdownCategoryKey, DropdownOption | null>;

function createInitialSelectionState(): SelectionState {
  return {
    pain_type: null,
    activity_type: null,
    weather_condition: null,
    trigger_type: null,
    relief_method: null,
  };
}

export default function AddEditScreen() {
  const { resolvedTheme } = useAppTheme();
  const theme = resolvedTheme;
  const colors = Colors[theme];

  const [note, setNote] = useState('');
  const [selections, setSelections] = useState<SelectionState>(createInitialSelectionState);

  const selectedCount = useMemo(
    () => Object.values(selections).filter((selection) => selection !== null).length,
    [selections]
  );

  const updateSelection = (categoryKey: DropdownCategoryKey, option: DropdownOption | null) => {
    setSelections((previous) => ({
      ...previous,
      [categoryKey]: option,
    }));
  };

  const resetForm = () => {
    setSelections(createInitialSelectionState());
    setNote('');
  };

  const saveDraft = () => {
    if (selectedCount === 0 && !note.trim()) {
      Alert.alert('Nothing To Save', 'Choose at least one dropdown option or add a quick note.');
      return;
    }

    Alert.alert('Draft Saved', 'Your selections have been captured locally for now.');
  };

  const submitEntry = () => {
    if (selectedCount === 0) {
      Alert.alert('Incomplete Entry', 'Pick at least one dropdown value before submitting.');
      return;
    }

    Alert.alert('Entry Logged', 'Your trigger map entry has been added.');
    resetForm();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.glowPrimary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(186, 195, 255, 0.08)' : 'rgba(3, 22, 50, 0.06)',
            },
          ]}
        />
        <View
          style={[
            styles.glowSecondary,
            {
              backgroundColor: theme === 'dark' ? 'rgba(102, 217, 204, 0.08)' : 'rgba(0, 104, 118, 0.07)',
            },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.heroPill}>
            <Text style={[styles.heroPillText, { color: colors.onPrimary }]}>Universal Log</Text>
          </LinearGradient>

          <Text style={[styles.heroTitle, { color: colors.text }]}>Add / Edit Entry</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Type to search, select from defaults, or add a custom value unique to your account.
          </Text>
        </View>

        <View
          style={[
            styles.formCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.ghostBorder,
            },
          ]}>
          {DROPDOWN_CATEGORY_DEFINITIONS.map((category) => (
            <SmartDropdown
              key={category.key}
              categoryKey={category.key}
              label={category.label}
              value={selections[category.key]}
              onChange={(option) => updateSelection(category.key, option)}
            />
          ))}

          <View style={styles.noteWrap}>
            <Text style={[styles.noteLabel, { color: colors.textMuted }]}>Quick Note</Text>
            <TextInput
              multiline
              onChangeText={setNote}
              placeholder="Add context for this entry..."
              placeholderTextColor={colors.outline}
              style={[
                styles.noteInput,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  color: colors.text,
                },
              ]}
              textAlignVertical="top"
              value={note}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={saveDraft}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.ghostBorder,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Save Draft</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={submitEntry} style={styles.primaryButtonWrap}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.primaryButton}>
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Submit Entry</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {selectedCount} dropdown {selectedCount === 1 ? 'selection' : 'selections'} active
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  glowPrimary: {
    borderRadius: 999,
    height: 260,
    left: -120,
    position: 'absolute',
    top: -70,
    width: 260,
  },
  glowSecondary: {
    borderRadius: 999,
    bottom: -140,
    height: 340,
    position: 'absolute',
    right: -150,
    width: 340,
  },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 6,
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  noteWrap: {
    gap: 8,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  noteInput: {
    borderRadius: 14,
    fontSize: 14,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonWrap: {
    borderRadius: 999,
    flex: 1,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
