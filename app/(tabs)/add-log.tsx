import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { IconButton, SegmentedButtons, Snackbar, Switch, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Radius, Spacing } from '../../constants/theme';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ItemSelector } from '../../components/forms/ItemSelector';

type StressLevel = 'none' | 'low' | 'moderate' | 'high';

interface SelectedItem {
  id: string;
  name: string;
}

interface PainEntry {
  id: string;
  body_part: string;
  pain_level: number;
  swelling: boolean;
}

const stressOptions: Array<{ value: StressLevel; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

function createPainEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AddLogScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { user } = useAuth();

  const [logDate, setLogDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [stressLevel, setStressLevel] = useState<StressLevel | null>(null);
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [bodyPartDraft, setBodyPartDraft] = useState('');
  const [bodyPartModalVisible, setBodyPartModalVisible] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState<SelectedItem[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<SelectedItem[]>([]);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<'medicine' | 'food'>('medicine');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const openSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);

    if (selectedDate) {
      const nextDate = new Date(logDate);
      nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setLogDate(nextDate);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);

    if (selectedTime) {
      const nextDate = new Date(logDate);
      nextDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setLogDate(nextDate);
    }
  };

  const openBodyPartModal = () => {
    setBodyPartDraft('');
    setBodyPartModalVisible(true);
  };

  const closeBodyPartModal = () => {
    setBodyPartModalVisible(false);
    setBodyPartDraft('');
  };

  const handleAddBodyPart = () => {
    const trimmedBodyPart = bodyPartDraft.trim();

    if (!trimmedBodyPart) {
      openSnackbar('Body part is required.');
      return;
    }

    setPainEntries((currentEntries) => [
      ...currentEntries,
      {
        id: createPainEntryId(),
        body_part: trimmedBodyPart,
        pain_level: 1,
        swelling: false,
      },
    ]);

    closeBodyPartModal();
  };

  const updatePainEntry = (entryId: string, updates: Partial<Omit<PainEntry, 'id'>>) => {
    setPainEntries((currentEntries) =>
      currentEntries.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    );
  };

  const removePainEntry = (entryId: string) => {
    setPainEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
  };

  const handleSaveLog = async () => {
    if (!user) {
      openSnackbar('You must be logged in to save entries.');
      return;
    }

    if (
      painEntries.length === 0 &&
      stressLevel === null &&
      selectedMedicines.length === 0 &&
      selectedFoods.length === 0
    ) {
      openSnackbar('Please enter at least one log (Pain, Stress, Medicine, or Food).');
      return;
    }

    setIsSaving(true);

    const loggedAt = logDate.toISOString();
    const logDateString = logDate.toLocaleDateString('en-CA');

    try {
      if (painEntries.length > 0) {
        const painInserts = painEntries.map((entry) => ({
          user_id: user.id,
          logged_at: loggedAt,
          log_date: logDateString,
          body_part: entry.body_part,
          pain_level: entry.pain_level,
          swelling: entry.swelling,
        }));

        const { error } = await supabase.from('pain_logs').insert(painInserts);

        if (error) {
          throw error;
        }
      }

      if (stressLevel !== null) {
        const { error } = await supabase.from('stress_logs').insert({
          user_id: user.id,
          logged_at: loggedAt,
          log_date: logDateString,
          level: stressLevel,
        });

        if (error) {
          throw error;
        }
      }

      if (selectedMedicines.length > 0) {
        const medicineInserts = selectedMedicines.map((medicine) => ({
          user_id: user.id,
          medicine_id: medicine.id,
          logged_at: loggedAt,
          log_date: logDateString,
        }));

        const { error } = await supabase.from('medicine_logs').insert(medicineInserts);

        if (error) {
          throw error;
        }
      }

      if (selectedFoods.length > 0) {
        const foodInserts = selectedFoods.map((food) => ({
          user_id: user.id,
          food_id: food.id,
          logged_at: loggedAt,
          log_date: logDateString,
        }));

        const { error } = await supabase.from('food_logs').insert(foodInserts);

        if (error) {
          throw error;
        }
      }

      router.back();
    } catch (error: any) {
      openSnackbar(error?.message || 'Something went wrong saving your log.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Add Entry
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Log your current context and feelings.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.text} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Date & Time
              </Text>
            </View>
          </View>
          <View style={styles.dateTimeRow}>
            <CustomButton mode="contained-tonal" onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </CustomButton>
            <CustomButton mode="contained-tonal" onPress={() => setShowTimePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </CustomButton>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="arm-flex" size={20} color={colors.text} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Pain by Body Part
              </Text>
            </View>
            <CustomButton mode="outlined" icon="plus" compact onPress={openBodyPartModal}>
              Add Body Part
            </CustomButton>
          </View>

          <Text variant="bodySmall" style={styles.sectionBody}>
            Track pain separately for each affected area.
          </Text>

          {painEntries.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyState}>
              No body parts added yet.
            </Text>
          ) : (
            painEntries.map((entry) => (
              <View
                key={entry.id}
                style={styles.painCard}
              >
                <View style={styles.painCardHeader}>
                  <Text variant="titleSmall" style={styles.painBodyPart} numberOfLines={1}>
                    {entry.body_part}
                  </Text>
                  <IconButton
                    icon="trash-can-outline"
                    iconColor={colors.error}
                    size={24}
                    onPress={() => removePainEntry(entry.id)}
                  />
                </View>

                <View style={styles.painSliderRow}>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={5}
                    step={1}
                    value={entry.pain_level}
                    onValueChange={(value) => updatePainEntry(entry.id, { pain_level: value })}
                    minimumTrackTintColor={colors.chartTrigger}
                    maximumTrackTintColor={colors.surfaceContainerHighest}
                    thumbTintColor={colors.chartTrigger}
                  />
                  <View style={styles.painLevelBadge}>
                    <Text variant="titleMedium" style={styles.painLevelText}>
                      {entry.pain_level}
                    </Text>
                  </View>
                </View>

                <View style={styles.swellingRow}>
                  <Text variant="bodyMedium" style={styles.swellingLabel}>
                    Swelling Present?
                  </Text>
                  <Switch
                    value={entry.swelling}
                    onValueChange={(value) => updatePainEntry(entry.id, { swelling: value })}
                    color={colors.primary}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="brain" size={20} color={colors.text} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Stress Level
              </Text>
            </View>
            {stressLevel !== null && (
              <CustomButton
                mode="text"
                onPress={() => setStressLevel(null)}
                compact
                contentStyle={styles.clearButtonContent}
                labelStyle={styles.clearButtonLabel}
              >
                Clear
              </CustomButton>
            )}
          </View>

          <Text variant="bodySmall" style={styles.sectionBody}>
            Select the current categorical stress level.
          </Text>

          <SegmentedButtons
            value={stressLevel ?? ''}
            onValueChange={(value) => {
              if (value === 'none' || value === 'low' || value === 'moderate' || value === 'high') {
                setStressLevel(value);
              }
            }}
            density="small"
            style={styles.segmentedRoot}
            buttons={stressOptions.map((option) => ({
              value: option.value,
              label: option.label,
              showSelectedCheck: false,
              style: styles.segmentedButton,
            }))}
            theme={{
              colors: {
                secondaryContainer: colors.primaryContainer,
                onSecondaryContainer: colors.onPrimaryContainer,
                outline: colors.ghostBorder,
              },
            }}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="pill" size={20} color={colors.text} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Medicine
              </Text>
            </View>
            <CustomButton
              mode="text"
              onPress={() => {
                setSelectorType('medicine');
                setSelectorVisible(true);
              }}
              compact
            >
              + Add
            </CustomButton>
          </View>

          {selectedMedicines.map((medicine) => (
            <View key={medicine.id} style={styles.selectedItemRow}>
              <Text variant="bodyMedium" style={styles.selectedItemText}>
                {medicine.name}
              </Text>
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={colors.error}
                onPress={() => setSelectedMedicines((currentItems) => currentItems.filter((currentMedicine) => currentMedicine.id !== medicine.id))}
                suppressHighlighting
              />
            </View>
          ))}

          {selectedMedicines.length === 0 && (
            <Text variant="bodySmall" style={styles.emptyState}>
              No medicine selected.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="food-apple" size={20} color={colors.text} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Meals & Food
              </Text>
            </View>
            <CustomButton
              mode="text"
              onPress={() => {
                setSelectorType('food');
                setSelectorVisible(true);
              }}
              compact
            >
              + Add
            </CustomButton>
          </View>

          {selectedFoods.map((food) => (
            <View key={food.id} style={styles.selectedItemRow}>
              <Text variant="bodyMedium" style={styles.selectedItemText}>
                {food.name}
              </Text>
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={colors.error}
                onPress={() => setSelectedFoods((currentItems) => currentItems.filter((currentFood) => currentFood.id !== food.id))}
                suppressHighlighting
              />
            </View>
          ))}

          {selectedFoods.length === 0 && (
            <Text variant="bodySmall" style={styles.emptyState}>
              No food selected.
            </Text>
          )}
        </View>

        <CustomButton mode="contained" onPress={handleSaveLog} isLoading={isSaving} style={styles.saveButton}>
          Save Entry
        </CustomButton>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker value={logDate} mode="date" display="default" onChange={handleDateChange} />
      )}

      {showTimePicker && (
        <DateTimePicker value={logDate} mode="time" display="default" onChange={handleTimeChange} />
      )}

      <Modal visible={bodyPartModalVisible} transparent animationType="fade" onRequestClose={closeBodyPartModal}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={closeBodyPartModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Add Body Part
                </Text>
                <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeBodyPartModal} />
              </View>

              <CustomTextInput
                label="Body part"
                placeholder="e.g. left knee"
                value={bodyPartDraft}
                onChangeText={setBodyPartDraft}
                autoCapitalize="words"
                autoFocus
              />

              <View style={styles.modalActions}>
                <CustomButton mode="outlined" onPress={closeBodyPartModal} style={styles.modalActionButton}>
                  Cancel
                </CustomButton>
                <CustomButton mode="contained" onPress={handleAddBodyPart} style={styles.modalActionButton}>
                  Add
                </CustomButton>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: colors.surfaceContainerHighest }}
        theme={{ colors: { onSurface: colors.text } }}
      >
        {snackbarMessage}
      </Snackbar>

      <ItemSelector
        type={selectorType}
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        onSelect={(id, displayName) => {
          if (selectorType === 'medicine') {
            if (!selectedMedicines.find((medicine) => medicine.id === id)) {
              setSelectedMedicines((currentItems) => [...currentItems, { id, name: displayName }]);
            }
          } else if (!selectedFoods.find((food) => food.id === id)) {
            setSelectedFoods((currentItems) => [...currentItems, { id, name: displayName }]);
          }
        }}
      />
    </ScreenWrapper>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.xxxl + Spacing.xl,
      gap: Spacing.lg,
    },
    header: {
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    headerTitle: {
      color: colors.text,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.glassSurface,
      borderColor: colors.ghostBorder,
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      flex: 1,
    },
    cardTitle: {
      color: colors.text,
      fontWeight: '700',
      flexShrink: 1,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    sectionBody: {
      color: colors.textMuted,
    },
    emptyState: {
      color: colors.textMuted,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    dateButton: {
      flex: 1,
    },
    painCard: {
      backgroundColor: colors.glassSurface,
      borderColor: colors.ghostBorder,
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.md,
      gap: Spacing.md,
      shadowColor: colors.shadowAmbient,
      elevation: 2,
    },
    painCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    painBodyPart: {
      color: colors.text,
      fontWeight: '700',
      flexShrink: 1,
    },
    painSliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    slider: {
      flex: 1,
      height: 48,
    },
    painLevelBadge: {
      minWidth: Spacing.xxxl,
      minHeight: Spacing.xxxl,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.ghostBorder,
      paddingHorizontal: Spacing.sm,
    },
    painLevelText: {
      color: colors.chartTrigger,
      fontWeight: '700',
    },
    swellingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    swellingLabel: {
      color: colors.text,
      flexShrink: 1,
    },
    segmentedRoot: {
      marginTop: Spacing.xs,
    },
    segmentedButton: {
      flex: 1,
    },
    selectedItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.ghostBorder,
    },
    selectedItemText: {
      color: colors.text,
      flex: 1,
      paddingRight: Spacing.sm,
    },
    clearButtonContent: {
      minHeight: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    clearButtonLabel: {
      marginVertical: Spacing.xs,
      marginHorizontal: Spacing.sm,
    },
    saveButton: {
      marginTop: Spacing.md,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.text,
      opacity: 0.45,
    },
    modalKeyboard: {
      flex: 1,
      justifyContent: 'center',
    },
    modalCard: {
      backgroundColor: colors.glassSurface,
      borderColor: colors.ghostBorder,
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      shadowColor: colors.shadowAmbient,
      elevation: 4,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    modalActionButton: {
      flex: 1,
    },
  });