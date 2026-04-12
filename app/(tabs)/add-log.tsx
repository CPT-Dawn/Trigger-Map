import React, { useCallback, useRef, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAppColors } from '../../providers/ThemeProvider';
import { ItemSelector, type ItemRecord, type ItemSelectorHandle } from '../../components/forms/ItemSelector';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

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

type AddLogColors = ReturnType<typeof useAppColors>;

interface LogSectionCardProps {
  delay: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  accentColor: string;
  colors: AddLogColors;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function LogSectionCard({ delay, icon, title, subtitle, accentColor, colors, action, children }: LogSectionCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} layout={Layout.springify()}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.glassSurface,
            borderColor: colors.ghostBorder,
            shadowColor: colors.shadowAmbient,
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.sectionIconShell, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
            </View>
            <View style={styles.cardTitleBlock}>
              <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySmall" style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {action}
        </View>

        <View style={styles.cardBody}>{children}</View>
      </View>
    </Animated.View>
  );
}

interface SelectionChipProps {
  label: string;
  accentColor: string;
  colors: AddLogColors;
  onRemove: () => void;
}

function SelectionChip({ label, accentColor, colors, onRemove }: SelectionChipProps) {
  return (
    <Animated.View
      layout={Layout.springify()}
      style={[
        styles.chip,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.ghostBorder,
        },
      ]}
    >
      <Text variant="bodySmall" style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={Spacing.sm} style={styles.chipCloseButton}>
        <MaterialCommunityIcons name="close" size={12} color={accentColor} />
      </Pressable>
    </Animated.View>
  );
}

interface PainEntryCardProps {
  entry: PainEntry;
  index: number;
  colors: AddLogColors;
  onChange: (entryId: string, updates: Partial<Omit<PainEntry, 'id'>>) => void;
  onRemove: (entryId: string) => void;
}

function PainEntryCard({ entry, index, colors, onChange, onRemove }: PainEntryCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()} layout={Layout.springify()}>
      <View
        style={[
          styles.painCard,
          {
            backgroundColor: colors.glassSurface,
            borderColor: colors.ghostBorder,
            shadowColor: colors.shadowAmbient,
          },
        ]}
      >
        <View style={styles.painCardHeader}>
          <Text variant="titleSmall" style={[styles.painBodyPart, { color: colors.text }]} numberOfLines={1}>
            {entry.body_part}
          </Text>
          <IconButton icon="trash-can-outline" iconColor={colors.error} size={22} onPress={() => onRemove(entry.id)} />
        </View>

        <View style={styles.painSliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={5}
            step={1}
            value={entry.pain_level}
            onValueChange={(value) => onChange(entry.id, { pain_level: value })}
            minimumTrackTintColor={colors.chartTrigger}
            maximumTrackTintColor={colors.surfaceContainerHighest}
            thumbTintColor={colors.chartTrigger}
          />
          <View
            style={[
              styles.painLevelBadge,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <Text variant="titleMedium" style={[styles.painLevelText, { color: colors.chartTrigger }]}>
              {entry.pain_level}
            </Text>
          </View>
        </View>

        <View style={styles.swellingRow}>
          <Text variant="bodyMedium" style={[styles.swellingLabel, { color: colors.text }]}>
            Swelling Present?
          </Text>
          <Switch
            value={entry.swelling}
            onValueChange={(value) => onChange(entry.id, { swelling: value })}
            color={colors.primary}
          />
        </View>
      </View>
    </Animated.View>
  );
}

interface SelectionSectionProps {
  delay: number;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  colors: AddLogColors;
  selectedItems: SelectedItem[];
  emptyText: string;
  buttonLabel: string;
  onOpen: () => void;
  onRemove: (id: string) => void;
}

function SelectionSection({
  delay,
  title,
  icon,
  accentColor,
  buttonColor,
  buttonTextColor,
  colors,
  selectedItems,
  emptyText,
  buttonLabel,
  onOpen,
  onRemove,
}: SelectionSectionProps) {
  return (
    <LogSectionCard
      delay={delay}
      icon={icon}
      title={title}
      subtitle="Choose from saved items or create a new master entry."
      accentColor={accentColor}
      colors={colors}
    >
      <CustomButton
        mode="contained"
        icon="plus"
        onPress={onOpen}
        buttonColor={buttonColor}
        textColor={buttonTextColor}
      >
        {buttonLabel}
      </CustomButton>

      {selectedItems.length > 0 ? (
        <View style={styles.chipWrap}>
          {selectedItems.map((item) => (
            <SelectionChip
              key={item.id}
              label={item.name}
              accentColor={accentColor}
              colors={colors}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </View>
      ) : (
        <Text variant="bodySmall" style={[styles.helperText, { color: colors.textMuted }]}>
          {emptyText}
        </Text>
      )}
    </LogSectionCard>
  );
}

export default function AddLogScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { user } = useAuth();

  const medicineSelectorRef = useRef<ItemSelectorHandle>(null);
  const foodSelectorRef = useRef<ItemSelectorHandle>(null);

  const [logDate, setLogDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [stressLevel, setStressLevel] = useState<StressLevel | null>(null);
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [bodyPartDraft, setBodyPartDraft] = useState('');
  const [bodyPartModalVisible, setBodyPartModalVisible] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState<SelectedItem[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<SelectedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const openSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowDatePicker(false);

      if (selectedDate) {
        const nextDate = new Date(logDate);
        nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        setLogDate(nextDate);
      }
    },
    [logDate],
  );

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      setShowTimePicker(false);

      if (selectedTime) {
        const nextDate = new Date(logDate);
        nextDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        setLogDate(nextDate);
      }
    },
    [logDate],
  );

  const openBodyPartModal = useCallback(() => {
    setBodyPartDraft('');
    setBodyPartModalVisible(true);
  }, []);

  const closeBodyPartModal = useCallback(() => {
    setBodyPartModalVisible(false);
    setBodyPartDraft('');
  }, []);

  const handleAddBodyPart = useCallback(() => {
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
  }, [bodyPartDraft, closeBodyPartModal, openSnackbar]);

  const updatePainEntry = useCallback((entryId: string, updates: Partial<Omit<PainEntry, 'id'>>) => {
    setPainEntries((currentEntries) =>
      currentEntries.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    );
  }, []);

  const removePainEntry = useCallback((entryId: string) => {
    setPainEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
  }, []);

  const handleSelectedItemChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<SelectedItem[]>>, item: ItemRecord) => {
      const nextName = item.display_name?.trim() || item.name?.trim() || 'Saved item';

      setter((currentItems) =>
        currentItems.some((currentItem) => currentItem.id === item.id)
          ? currentItems.map((currentItem) =>
              currentItem.id === item.id ? { id: item.id, name: nextName } : currentItem,
            )
          : currentItems,
      );
    },
    [],
  );

  const handleMedicineItemChange = useCallback(
    (item: ItemRecord) => {
      handleSelectedItemChange(setSelectedMedicines, item);
    },
    [handleSelectedItemChange],
  );

  const handleFoodItemChange = useCallback(
    (item: ItemRecord) => {
      handleSelectedItemChange(setSelectedFoods, item);
    },
    [handleSelectedItemChange],
  );

  const handleMedicineItemDelete = useCallback((itemId: string) => {
    setSelectedMedicines((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  const handleFoodItemDelete = useCallback((itemId: string) => {
    setSelectedFoods((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  const handleSaveLog = useCallback(async () => {
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
  }, [
    logDate,
    openSnackbar,
    painEntries,
    router,
    selectedFoods,
    selectedMedicines,
    stressLevel,
    user,
  ]);

  const handleOpenMedicineSelector = useCallback(() => {
    medicineSelectorRef.current?.present();
  }, []);

  const handleOpenFoodSelector = useCallback(() => {
    foodSelectorRef.current?.present();
  }, []);

  const handleMedicineChipRemove = useCallback((itemId: string) => {
    setSelectedMedicines((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  const handleFoodChipRemove = useCallback((itemId: string) => {
    setSelectedFoods((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LogSectionCard
          delay={0}
          icon="clock-outline"
          title="Date & Time"
          subtitle="Capture exactly when the entry happened."
          accentColor={colors.primary}
          colors={colors}
        >
          <View style={styles.dateTimeRow}>
            <CustomButton mode="outlined" icon="calendar-month" onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </CustomButton>
            <CustomButton mode="outlined" icon="clock-outline" onPress={() => setShowTimePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </CustomButton>
          </View>
        </LogSectionCard>

        <LogSectionCard
          delay={100}
          icon="brain"
          title="Stress Level"
          subtitle="Select the current categorical stress level."
          accentColor={colors.secondary}
          colors={colors}
          action={
            stressLevel !== null ? (
              <CustomButton mode="text" onPress={() => setStressLevel(null)} compact style={styles.clearButton}>
                Clear
              </CustomButton>
            ) : null
          }
        >
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
        </LogSectionCard>

        <LogSectionCard
          delay={200}
          icon="arm-flex"
          title="Pain by Body Part"
          subtitle="Track pain separately for each affected area."
          accentColor={colors.chartTrigger}
          colors={colors}
          action={
            <CustomButton mode="outlined" icon="plus" compact onPress={openBodyPartModal}>
              Add Body Part
            </CustomButton>
          }
        >
          {painEntries.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.emptyState, { color: colors.textMuted }]}>
              No body parts added yet.
            </Text>
          ) : (
            painEntries.map((entry, index) => (
              <PainEntryCard key={entry.id} entry={entry} index={index} colors={colors} onChange={updatePainEntry} onRemove={removePainEntry} />
            ))
          )}
        </LogSectionCard>

        <SelectionSection
          delay={300}
          title="Medicine"
          icon="pill"
          accentColor={colors.primary}
          buttonColor={colors.primaryContainer}
          buttonTextColor={colors.onPrimaryContainer}
          colors={colors}
          selectedItems={selectedMedicines}
          emptyText="No medicine selected yet."
          buttonLabel="Open Medicine Selector"
          onOpen={handleOpenMedicineSelector}
          onRemove={handleMedicineChipRemove}
        />

        <SelectionSection
          delay={400}
          title="Food"
          icon="food-apple"
          accentColor={colors.secondary}
          buttonColor={colors.secondaryContainer}
          buttonTextColor={colors.onSecondaryContainer}
          colors={colors}
          selectedItems={selectedFoods}
          emptyText="No food selected yet."
          buttonLabel="Open Food Selector"
          onOpen={handleOpenFoodSelector}
          onRemove={handleFoodChipRemove}
        />

        <Animated.View entering={FadeInDown.delay(500).springify()} layout={Layout.springify()}>
          <CustomButton mode="contained" onPress={handleSaveLog} isLoading={isSaving} style={styles.saveButton}>
            Save Entry
          </CustomButton>
        </Animated.View>
      </ScrollView>

      {showDatePicker && <DateTimePicker value={logDate} mode="date" display="default" onChange={handleDateChange} />}

      {showTimePicker && <DateTimePicker value={logDate} mode="time" display="default" onChange={handleTimeChange} />}

      <Modal visible={bodyPartModalVisible} transparent animationType="fade" onRequestClose={closeBodyPartModal}>
        <View style={styles.modalContainer}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: colors.text }]}
            onPress={closeBodyPartModal}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.glassSurface,
                  borderColor: colors.ghostBorder,
                  shadowColor: colors.shadowAmbient,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.text }]}>
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
        ref={medicineSelectorRef}
        type="medicine"
        onSelect={(id, displayName) => {
          setSelectedMedicines((currentItems) =>
            currentItems.some((medicine) => medicine.id === id)
              ? currentItems
              : [...currentItems, { id, name: displayName }],
          );
        }}
        onMasterItemChange={handleMedicineItemChange}
        onMasterItemDelete={handleMedicineItemDelete}
      />

      <ItemSelector
        ref={foodSelectorRef}
        type="food"
        onSelect={(id, displayName) => {
          setSelectedFoods((currentItems) =>
            currentItems.some((food) => food.id === id) ? currentItems : [...currentItems, { id, name: displayName }],
          );
        }}
        onMasterItemChange={handleFoodItemChange}
        onMasterItemDelete={handleFoodItemDelete}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxxl + Spacing.xl,
      gap: Spacing.lg,
    },
    card: {
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      flex: 1,
    },
    sectionIconShell: {
      width: 40,
      height: 40,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleBlock: {
      flex: 1,
      gap: Spacing.xs,
    },
    cardTitle: {
      fontWeight: '700',
      flexShrink: 1,
    },
    cardSubtitle: {
      lineHeight: 20,
    },
    cardBody: {
      gap: Spacing.md,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    dateButton: {
      flex: 1,
    },
    clearButton: {
      marginTop: -Spacing.xs,
    },
    segmentedRoot: {
      marginTop: Spacing.xs,
    },
    segmentedButton: {
      flex: 1,
    },
    emptyState: {
      textAlign: 'center',
    },
    painCard: {
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.md,
      gap: Spacing.md,
      elevation: 2,
    },
    painCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    painBodyPart: {
      fontWeight: '700',
      flex: 1,
      paddingRight: Spacing.sm,
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
      borderWidth: 1,
      paddingHorizontal: Spacing.sm,
    },
    painLevelText: {
      fontWeight: '700',
    },
    swellingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    swellingLabel: {
      flexShrink: 1,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.full,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      minHeight: 36,
    },
    chipLabel: {
      flexShrink: 1,
      maxWidth: 180,
    },
    chipCloseButton: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helperText: {
      textAlign: 'center',
    },
    saveButton: {
      marginTop: Spacing.sm,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.45,
    },
    modalKeyboard: {
      flex: 1,
      justifyContent: 'center',
    },
    modalCard: {
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      elevation: 4,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    modalTitle: {
      fontWeight: '700',
      flex: 1,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    modalActionButton: {
      flex: 1,
    },
  });