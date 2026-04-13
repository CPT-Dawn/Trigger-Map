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
import { IconButton, SegmentedButtons, Switch, Text } from 'react-native-paper';
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
import { AppCard } from '../../components/ui/AppCard';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { CustomButton } from '../../components/ui/CustomButton';
import { CustomTextInput } from '../../components/ui/CustomTextInput';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';

type StressLevel = 'none' | 'low' | 'Mid' | 'high';

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
  { value: 'Mid', label: 'Mid' },
  { value: 'high', label: 'High' },
];

const cardReveal = (delay: number) => FadeInDown.delay(delay).duration(340);

function createPainEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function LogSectionCard({ delay, icon, title, accentColor, colors, action, children }: LogSectionCardProps) {
  return (
    <Animated.View entering={cardReveal(delay)} layout={Layout.springify()}>
      <AppCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.sectionIconShell, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
            </View>
            <View style={styles.cardTitleBlock}>
              <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
                {title}
              </Text>
            </View>
          </View>
          {action}
        </View>

        <View style={styles.cardBody}>{children}</View>
      </AppCard>
    </Animated.View>
  );
}

interface SelectionChipProps {
  label: string;
  accentColor: string;
  colors: AddLogColors;
  onEdit?: () => void;
  onRemove: () => void;
}

function SelectionChip({ label, accentColor, colors, onEdit, onRemove }: SelectionChipProps) {
  return (
    <Animated.View
      layout={Layout.springify()}
      style={[
        styles.selectionRowItem,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.ghostBorder,
        },
      ]}
    >
      <Text variant="bodyMedium" style={[styles.selectionRowLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.selectionRowActions}>
        {onEdit ? (
          <IconButton
            icon="pencil-outline"
            iconColor={accentColor}
            size={20}
            style={styles.selectionRowButton}
            onPress={onEdit}
          />
        ) : null}
        <IconButton
          icon="trash-can-outline"
          iconColor={colors.error}
          size={20}
          style={styles.selectionRowButton}
          onPress={onRemove}
        />
      </View>
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
    <Animated.View entering={cardReveal(index * 42)} layout={Layout.springify()}>
      <AppCard style={styles.painCard} variant="subtle">
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
        <CustomButton mode="contained-tonal" icon="plus" compact onPress={onOpen} buttonColor={buttonColor} textColor={buttonTextColor} style={styles.headerButton}>
          Add
        </CustomButton>
      }
    >
      {selectedItems.length > 0 && (
        <View style={styles.itemList}>
          {selectedItems.map((item) => (
            <SelectionChip
              key={item.id}
              label={item.name}
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

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <LogSectionCard
          delay={0}
          icon="clock-outline"
          title="Date & Time"
          accentColor={colors.primary}
          colors={colors}
        >
          <View style={styles.dateTimeRow}>
            <CustomButton mode="outlined" icon="calendar-month" compact onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </CustomButton>
            <CustomButton mode="outlined" icon="clock-outline" compact onPress={() => setShowTimePicker(true)} style={styles.dateButton}>
              {logDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }).replace(/\s?(AM|PM)$/i, (match) => match.toLowerCase())}
            </CustomButton>
          </View>
        </LogSectionCard>

        <SelectionSection
          delay={100}
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
          delay={200}
          icon="arm-flex"
          title="Pain by Body Part"
          accentColor={colors.chartTrigger}
          colors={colors}
          action={
            <CustomButton mode="contained-tonal" icon="plus" compact onPress={openBodyPartModal} buttonColor={colors.tertiaryContainer} textColor={colors.onTertiaryContainer} style={styles.headerButton}>
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
          delay={300}
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

        <Animated.View entering={cardReveal(500)} layout={Layout.springify()}>
          <CustomButton
            mode="contained"
            onPress={handleSaveLog}
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

      <Modal visible={bodyPartModalVisible} transparent animationType="fade" onRequestClose={closeBodyPartModal}>
        <View style={styles.modalContainer}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: colors.text, opacity: 0.66 }]}
            onPress={closeBodyPartModal}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <AppCard style={styles.modalCard}>
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
            </AppCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxxl + Spacing.lg,
      gap: Spacing.md,
    },
    card: {
      padding: Spacing.md,
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radius.xl,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
    },
    sectionIconShell: {
      width: 42,
      height: 42,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleBlock: {
      flex: 1,
      gap: Spacing.xxs,
    },
    cardTitle: {
      fontWeight: '700',
      flexShrink: 1,
    },
    cardSubtitle: {
      lineHeight: 18,
    },
    cardBody: {
      gap: Spacing.sm,
      marginTop: Spacing.xxs,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    dateButton: {
      flex: 1,
    },
    headerButton: {
      marginRight: -Spacing.xs,
      marginTop: -Spacing.xxs,
    },
    clearButton: {
      marginRight: -Spacing.xs,
      marginTop: -Spacing.xxs,
    },
    segmentedRoot: {
      marginTop: 0,
    },
    segmentedButton: {
      flex: 1,
    },
    painCard: {
      padding: Spacing.sm,
      paddingHorizontal: Spacing.md,
      gap: Spacing.xs,
      borderRadius: Radius.lg,
      borderWidth: 1,
    },
    painCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: -Spacing.xs,
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
      height: 40,
    },
    painLevelBadge: {
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
      gap: Spacing.md,
    },
    swellingLabel: {
      flexShrink: 1,
    },
    itemList: {
      gap: Spacing.sm,
      marginTop: Spacing.xxs,
    },
    selectionRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xs,
      minHeight: 44,
    },
    selectionRowLabel: {
      flex: 1,
    },
    selectionRowActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectionRowButton: {
      margin: 0,
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
      padding: Spacing.lg,
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