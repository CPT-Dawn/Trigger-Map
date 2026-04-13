import React, { useCallback, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Chip, IconButton, SegmentedButtons, Switch, Text } from 'react-native-paper';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Radius, Spacing } from '../../constants/theme';
import { addToSyncQueue, createUuid, db } from '../../lib/localDb';
import { runSync } from '../../lib/syncEngine';
import { useAuth } from '../../providers/AuthProvider';
import { useAppColors } from '../../providers/ThemeProvider';
import { ItemSelector, type ItemRecord, type ItemSelectorHandle } from '../../components/forms/ItemSelector';
import { AppCard } from '../../components/ui/AppCard';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { CustomButton } from '../../components/ui/CustomButton';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

type StressLevel = 'none' | 'low' | 'Mid' | 'high';

interface SelectedItem {
  id: string;
  name: string;
}

interface ItemSnapshotRow {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  display_name: string | null;
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
  { value: 'Mid', label: 'Mid' },
  { value: 'high', label: 'High' },
];

const cardReveal = (delay: number) => FadeInDown.delay(delay).duration(340);

function createPainEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStressLevel(level: StressLevel) {
  if (level === 'Mid') {
    return 'moderate';
  }

  return level;
}

type AddLogColors = ReturnType<typeof useAppColors>;

interface LogSectionCardProps {
  delay: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  accentColor: string;
  colors: AddLogColors;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function LogSectionCard({
  delay,
  icon,
  title,
  accentColor,
  colors,
  action,
  children,
}: LogSectionCardProps) {
  return (
    <Animated.View
      entering={cardReveal(delay)}
      layout={Layout.springify().damping(22).stiffness(210).mass(0.9)}
      style={styles.sectionCardWrap}
    >
      <AppCard
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.ghostBorder,
            borderLeftColor: accentColor,
            shadowColor: colors.shadowAmbient,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeading}>
            <View style={[styles.sectionIconShell, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
            </View>
            <View style={styles.sectionTitleBlock}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text }]}>
                {title}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeaderTrailing}>
            {action}
          </View>
        </View>

        <View style={styles.sectionBody}>{children}</View>
      </AppCard>
    </Animated.View>
  );
}

interface SelectionChipProps {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
  colors: AddLogColors;
  onEdit?: () => void;
  onRemove: () => void;
}

function SelectionChip({ label, icon, accentColor, colors, onEdit, onRemove }: SelectionChipProps) {
  return (
    <Animated.View layout={Layout.springify().damping(22).stiffness(205)}>
      <AppCard
        style={[
          styles.selectionEntryCard,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.ghostBorder,
            shadowColor: colors.shadowAmbient,
          },
        ]}
        variant="subtle"
      >
        <View style={styles.selectionEntryRow}>
          <View style={[styles.selectionEntryIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialCommunityIcons name={icon} size={18} color={accentColor} />
          </View>

          <Text variant="titleSmall" style={[styles.selectionEntryLabel, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>

          <View style={styles.selectionEntryActions}>
            {onEdit ? (
              <IconButton
                icon="pencil-outline"
                iconColor={accentColor}
                containerColor={colors.surfaceContainerHighest}
                size={20}
                style={styles.selectionEntryButton}
                onPress={onEdit}
              />
            ) : null}
            <IconButton
              icon="trash-can-outline"
              iconColor={colors.error}
              containerColor={colors.errorContainer}
              size={20}
              style={styles.selectionEntryButton}
              onPress={onRemove}
            />
          </View>
        </View>
      </AppCard>
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
    <Animated.View entering={cardReveal(index * 42)} layout={Layout.springify().damping(22).stiffness(210)}>
      <AppCard
        style={[
          styles.painEntryCard,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.ghostBorder,
            borderLeftColor: colors.chartTrigger,
            shadowColor: colors.shadowAmbient,
          },
        ]}
        variant="subtle"
      >
        <View style={styles.painEntryHeader}>
          <View style={styles.painEntryTitleRow}>
            <View style={[styles.painEntryIconWrap, { backgroundColor: colors.surfaceContainerHighest }]}>
              <MaterialCommunityIcons name="arm-flex" size={18} color={colors.chartTrigger} />
            </View>
            <Text variant="titleSmall" style={[styles.painBodyPart, { color: colors.text }]} numberOfLines={1}>
              {entry.body_part}
            </Text>
          </View>

          <View style={styles.painEntryHeaderActions}>
            <Chip compact style={[styles.painEntryLevelChip, { backgroundColor: colors.tertiaryContainer }]} textStyle={{ color: colors.onTertiaryContainer }}>
              Level {entry.pain_level}/5
            </Chip>
            <IconButton
              icon="trash-can-outline"
              iconColor={colors.error}
              containerColor={colors.errorContainer}
              size={20}
              style={styles.painEntryDeleteButton}
              onPress={() => onRemove(entry.id)}
            />
          </View>
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
              styles.painLevelMeter,
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
      </AppCard>
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
  onEditItem?: (id: string) => void;
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
  onEditItem,
  onOpen,
  onRemove,
}: SelectionSectionProps) {
  return (
    <LogSectionCard
      delay={delay}
      icon={icon}
      title={title}
      accentColor={accentColor}
      colors={colors}
      action={
        <CustomButton
          mode="contained-tonal"
          icon="plus"
          compact
          onPress={onOpen}
          buttonColor={buttonColor}
          textColor={buttonTextColor}
          style={styles.sectionActionButton}
          contentStyle={styles.compactHeaderButtonContent}
          labelStyle={styles.compactHeaderButtonLabel}
        >
          Add
        </CustomButton>
      }
    >
      {selectedItems.length > 0 && (
        <View style={styles.selectionEntryList}>
          {selectedItems.map((item) => (
            <SelectionChip
              key={item.id}
              label={item.name}
              icon={icon}
              accentColor={accentColor}
              colors={colors}
              onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </View>
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
  const bodyPartSheetRef = useRef<BottomSheetModal>(null);
  const [selectedMedicines, setSelectedMedicines] = useState<SelectedItem[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<SelectedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const resetAddLogForm = useCallback(() => {
    setLogDate(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setStressLevel(null);
    setPainEntries([]);
    setBodyPartDraft('');
    setSelectedMedicines([]);
    setSelectedFoods([]);
    setSnackbarMessage('');
    setSnackbarVisible(false);

    bodyPartSheetRef.current?.dismiss();
    medicineSelectorRef.current?.dismiss();
    foodSelectorRef.current?.dismiss();
  }, []);

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
    bodyPartSheetRef.current?.present();
  }, []);

  const closeBodyPartModal = useCallback(() => {
    bodyPartSheetRef.current?.dismiss();
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
      db.execSync('BEGIN TRANSACTION;');

      try {
        if (painEntries.length > 0) {
          for (const entry of painEntries) {
            const id = createUuid();
            const payload = {
              id,
              user_id: user.id,
              logged_at: loggedAt,
              log_date: logDateString,
              body_part: entry.body_part,
              pain_level: entry.pain_level,
              swelling: entry.swelling,
            };

            db.runSync(
              `
                INSERT INTO pain_logs
                (id, user_id, logged_at, log_date, body_part, pain_level, swelling)
                VALUES (?, ?, ?, ?, ?, ?, ?);
              `,
              [
                payload.id,
                payload.user_id,
                payload.logged_at,
                payload.log_date,
                payload.body_part,
                payload.pain_level,
                payload.swelling ? 1 : 0,
              ],
            );

            addToSyncQueue('pain_logs', 'INSERT', payload);
          }
        }

        if (stressLevel !== null) {
          const id = createUuid();
          const normalizedStressLevel = normalizeStressLevel(stressLevel);
          const payload = {
            id,
            user_id: user.id,
            logged_at: loggedAt,
            log_date: logDateString,
            level: normalizedStressLevel,
          };

          db.runSync(
            `
              INSERT INTO stress_logs
              (id, user_id, logged_at, log_date, level)
              VALUES (?, ?, ?, ?, ?);
            `,
            [payload.id, payload.user_id, payload.logged_at, payload.log_date, payload.level],
          );

          addToSyncQueue('stress_logs', 'INSERT', payload);
        }

        if (selectedMedicines.length > 0) {
          for (const medicine of selectedMedicines) {
            const id = createUuid();
            const snapshotRow = db.getFirstSync<ItemSnapshotRow>(
              `
                SELECT name, quantity, unit, display_name
                FROM user_medicines
                WHERE id = ? AND user_id = ?;
              `,
              [medicine.id, user.id],
            );

            const itemName = snapshotRow?.name?.trim() || medicine.name;
            const itemQuantity = snapshotRow?.quantity ?? null;
            const itemUnit = snapshotRow?.unit?.trim() || null;
            const itemDisplayName = snapshotRow?.display_name?.trim() || medicine.name;

            const queuePayload = {
              id,
              user_id: user.id,
              medicine_id: medicine.id,
              logged_at: loggedAt,
              log_date: logDateString,
            };

            const localRow = {
              ...queuePayload,
              item_display_name: itemDisplayName,
              item_name: itemName,
              item_quantity: itemQuantity,
              item_unit: itemUnit,
            };

            db.runSync(
              `
                INSERT INTO medicine_logs
                (id, user_id, medicine_id, item_display_name, item_name, item_quantity, item_unit, logged_at, log_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
              `,
              [
                localRow.id,
                localRow.user_id,
                localRow.medicine_id,
                localRow.item_display_name,
                localRow.item_name,
                localRow.item_quantity,
                localRow.item_unit,
                localRow.logged_at,
                localRow.log_date,
              ],
            );

            addToSyncQueue('medicine_logs', 'INSERT', queuePayload);
          }
        }

        if (selectedFoods.length > 0) {
          for (const food of selectedFoods) {
            const id = createUuid();
            const snapshotRow = db.getFirstSync<ItemSnapshotRow>(
              `
                SELECT name, quantity, unit, display_name
                FROM user_foods
                WHERE id = ? AND user_id = ?;
              `,
              [food.id, user.id],
            );

            const itemName = snapshotRow?.name?.trim() || food.name;
            const itemQuantity = snapshotRow?.quantity ?? null;
            const itemUnit = snapshotRow?.unit?.trim() || null;
            const itemDisplayName = snapshotRow?.display_name?.trim() || food.name;

            const queuePayload = {
              id,
              user_id: user.id,
              food_id: food.id,
              logged_at: loggedAt,
              log_date: logDateString,
            };

            const localRow = {
              ...queuePayload,
              item_display_name: itemDisplayName,
              item_name: itemName,
              item_quantity: itemQuantity,
              item_unit: itemUnit,
            };

            db.runSync(
              `
                INSERT INTO food_logs
                (id, user_id, food_id, item_display_name, item_name, item_quantity, item_unit, logged_at, log_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
              `,
              [
                localRow.id,
                localRow.user_id,
                localRow.food_id,
                localRow.item_display_name,
                localRow.item_name,
                localRow.item_quantity,
                localRow.item_unit,
                localRow.logged_at,
                localRow.log_date,
              ],
            );

            addToSyncQueue('food_logs', 'INSERT', queuePayload);
          }
        }

        db.execSync('COMMIT;');
      } catch (error) {
        db.execSync('ROLLBACK;');
        throw error;
      }

      void runSync();
      resetAddLogForm();
      router.replace('/(tabs)/logs');
    } catch (error: any) {
      openSnackbar(error?.message || 'Something went wrong saving your log.');
    } finally {
      setIsSaving(false);
    }
  }, [
    logDate,
    openSnackbar,
    painEntries,
    resetAddLogForm,
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

  const handleEditMedicineItem = useCallback((itemId: string) => {
    medicineSelectorRef.current?.present({ editItemId: itemId });
  }, []);

  const handleEditFoodItem = useCallback((itemId: string) => {
    foodSelectorRef.current?.present({ editItemId: itemId });
  }, []);

  const handleMedicineChipRemove = useCallback((itemId: string) => {
    setSelectedMedicines((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  const handleFoodChipRemove = useCallback((itemId: string) => {
    setSelectedFoods((currentItems) => currentItems.filter((currentItem) => currentItem.id !== itemId));
  }, []);

  const totalLogEntries =
    painEntries.length + selectedFoods.length + selectedMedicines.length + (stressLevel !== null ? 1 : 0);

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <LogSectionCard
          delay={60}
          icon="clock-outline"
          title="Date & Time"
          accentColor={colors.primary}
          colors={colors}
        >
          <View style={styles.dateTimeRow}>
            <CustomButton
              mode="outlined"
              icon="calendar-month"
              compact
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
              contentStyle={styles.compactHeaderButtonContent}
              labelStyle={styles.compactHeaderButtonLabel}
            >
              {logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </CustomButton>
            <CustomButton
              mode="outlined"
              icon="clock-outline"
              compact
              onPress={() => setShowTimePicker(true)}
              style={styles.dateButton}
              contentStyle={styles.compactHeaderButtonContent}
              labelStyle={styles.compactHeaderButtonLabel}
            >
              {logDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }).replace(/\s?(AM|PM)$/i, (match) => match.toLowerCase())}
            </CustomButton>
          </View>
        </LogSectionCard>

        <SelectionSection
          delay={130}
          icon="food-apple"
          title="Food"
          accentColor={colors.secondary}
          buttonColor={colors.secondaryContainer}
          buttonTextColor={colors.onSecondaryContainer}
          colors={colors}
          selectedItems={selectedFoods}
          onEditItem={handleEditFoodItem}
          onOpen={handleOpenFoodSelector}
          onRemove={handleFoodChipRemove}
        />

        <LogSectionCard
          delay={220}
          icon="arm-flex"
          title="Pain"
          accentColor={colors.chartTrigger}
          colors={colors}
          action={
            <CustomButton
              mode="contained-tonal"
              icon="plus"
              compact
              onPress={openBodyPartModal}
              buttonColor={colors.tertiaryContainer}
              textColor={colors.onTertiaryContainer}
              style={styles.sectionActionButton}
              contentStyle={styles.compactHeaderButtonContent}
              labelStyle={styles.compactHeaderButtonLabel}
            >
              Add
            </CustomButton>
          }
        >
          {painEntries.length > 0 &&
            painEntries.map((entry, index) => (
              <PainEntryCard key={entry.id} entry={entry} index={index} colors={colors} onChange={updatePainEntry} onRemove={removePainEntry} />
            ))}
        </LogSectionCard>

        <SelectionSection
          delay={310}
          title="Medicine"
          icon="pill"
          accentColor={colors.primary}
          buttonColor={colors.primaryContainer}
          buttonTextColor={colors.onPrimaryContainer}
          colors={colors}
          selectedItems={selectedMedicines}
          onEditItem={handleEditMedicineItem}
          onOpen={handleOpenMedicineSelector}
          onRemove={handleMedicineChipRemove}
        />

        <LogSectionCard
          delay={400}
          icon="brain"
          title="Stress Level"
          accentColor={colors.secondary}
          colors={colors}
          action={
            <View style={styles.clearActionSlot}>
              {stressLevel !== null ? (
                <CustomButton
                  mode="text"
                  onPress={() => setStressLevel(null)}
                  compact
                  style={styles.clearButton}
                  contentStyle={styles.clearButtonContent}
                  labelStyle={styles.clearButtonLabel}
                >
                  Clear
                </CustomButton>
              ) : null}
            </View>
          }
        >
          <SegmentedButtons
            value={stressLevel ?? ''}
            onValueChange={(value) => {
              if (value === 'none' || value === 'low' || value === 'Mid' || value === 'high') {
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

        <Animated.View entering={cardReveal(500)} layout={Layout.springify().damping(22).stiffness(205)} style={styles.saveCardWrap}>

            <CustomButton
              mode="contained"
              onPress={handleSaveLog}
              disabled={totalLogEntries === 0}
              isLoading={isSaving}
              buttonColor={colors.primary}
              textColor={colors.onPrimary}
              style={styles.saveButton}
            >
              Save Entry
            </CustomButton>
        </Animated.View>
      </ScrollView>

      {showDatePicker && <DateTimePicker value={logDate} mode="date" display="default" onChange={handleDateChange} />}

      {showTimePicker && <DateTimePicker value={logDate} mode="time" display="default" onChange={handleTimeChange} />}

      <BottomSheetModal
        ref={bodyPartSheetRef}
        index={0}
        snapPoints={['50%', '85%']}
        enablePanDownToClose
        enableDismissOnClose
        backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}
        handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.ghostBorder }]}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} />
        )}
        keyboardBehavior="fillParent"
        keyboardBlurBehavior="restore"
        enableBlurKeyboardOnGesture
        android_keyboardInputMode="adjustResize"
        onDismiss={() => setBodyPartDraft('')}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.bodyPartScrollContent}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.text }]}>
                Add Body Part
              </Text>
              <IconButton icon="close" iconColor={colors.text} size={24} onPress={closeBodyPartModal} />
            </View>

            <View style={styles.fieldBlock}>
              <Text variant="labelMedium" style={[styles.fieldLabel, { color: colors.textMuted }]}>
                Body part
              </Text>
              <View
                style={[
                  styles.fieldSurface,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <BottomSheetTextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  placeholder="e.g. left knee"
                  placeholderTextColor={colors.textMuted}
                  value={bodyPartDraft}
                  onChangeText={setBodyPartDraft}
                  autoCapitalize="words"
                  autoFocus={Platform.OS === 'ios'}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <CustomButton mode="text" onPress={closeBodyPartModal} style={styles.modalActionButton}>
                Cancel
              </CustomButton>
              <CustomButton
                mode="contained"
                onPress={handleAddBodyPart}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                style={styles.modalActionButton}
              >
                Add
              </CustomButton>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <AppSnackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </AppSnackbar>

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
  sheetBackground: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
  },
  handleIndicator: {
    width: 48,
    height: 5,
  },
  fieldBlock: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    marginLeft: Spacing.xs,
  },
  fieldSurface: {
    minHeight: 52,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fieldInput: {
    flex: 1,
    minHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl + Spacing.lg,
    gap: Spacing.sm,
  },
  heroBlock: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroTitle: {
    fontWeight: '700',
    flex: 1,
  },
  heroSubtitle: {
    lineHeight: 20,
  },
  heroCountChip: {
    borderRadius: Radius.full,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroMetaChip: {
    borderRadius: Radius.full,
  },
  sectionCardWrap: {
    gap: Spacing.xxs,
  },
  sectionCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: Radius.xl,
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  sectionHeaderLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    minWidth: 0,
  },
  sectionHeaderTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  sectionIconShell: {
    width: 38,
    height: 38,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleBlock: {
    flex: 1,
    gap: Spacing.xxs,
    minWidth: 0,
  },
  sectionTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  sectionBody: {
    gap: Spacing.xs,
    marginTop: 0,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dateButton: {
    flex: 1,
  },
  compactHeaderButtonContent: {
    minHeight: 48,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
  },
  compactHeaderButtonLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  sectionActionButton: {
    marginRight: -Spacing.xs,
    marginTop: 0,
  },
  clearActionSlot: {
    width: 76,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  clearButton: {
    marginVertical: 0,
    width: 72,
  },
  clearButtonContent: {
    minHeight: 48,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
  },
  clearButtonLabel: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  segmentedRoot: {
    marginTop: Spacing.xs,
  },
  segmentedButton: {
    flex: 1,
  },
  painEntryCard: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  painEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  painEntryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  painEntryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painBodyPart: {
    fontWeight: '700',
    flex: 1,
  },
  painEntryHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  painEntryLevelChip: {
    borderRadius: Radius.full,
  },
  painEntryDeleteButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  painSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  painLevelMeter: {
    minWidth: Spacing.xxxl,
    minHeight: Spacing.xxxl,
    borderRadius: Radius.md,
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
    gap: Spacing.sm,
  },
  swellingLabel: {
    flexShrink: 1,
  },
  selectionEntryList: {
    gap: Spacing.xs,
    marginTop: 0,
  },
  selectionEntryCard: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  selectionEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    minHeight: 48,
  },
  selectionEntryIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionEntryLabel: {
    flex: 1,
    fontWeight: '600',
  },
  selectionEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  selectionEntryButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  saveCardWrap: {
    marginTop: Spacing.xs,
  },
  saveCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: Spacing.sm,
    padding: Spacing.md,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  saveCardHeader: {
    gap: Spacing.xs,
  },
  saveCardTitle: {
    fontWeight: '700',
  },
  saveCardSubtitle: {
    lineHeight: 19,
  },
  saveButton: {
    marginTop: Spacing.xs,
  },
  modalCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  bodyPartScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl + Spacing.xl,
    gap: Spacing.md,
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
