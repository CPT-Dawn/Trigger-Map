import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { Radius, Spacing } from '../constants/theme';
import { ScreenWrapper } from '../components/ui/ScreenWrapper';
import { CustomButton } from '../components/ui/CustomButton';
import { CustomTextInput } from '../components/ui/CustomTextInput';
import { ItemSelector } from '../components/forms/ItemSelector';

interface SelectedItem {
  id: string;
  name: string;
}

export default function AddLogScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { user } = useAuth();

  // State
  const [logDate, setLogDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [selectedMedicines, setSelectedMedicines] = useState<SelectedItem[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<SelectedItem[]>([]);
  
  // Item Selector State
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<'medicine' | 'food'>('medicine');
  
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Time & Date Handlers
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(logDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setLogDate(newDate);
    }
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(logDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setLogDate(newDate);
    }
  };

  const openSnackbar = (msg: string) => {
    setSnackbarMessage(msg);
    setSnackbarVisible(true);
  };

  // Submit Logic
  const handleSaveLog = async () => {
    if (!user) {
      openSnackbar('You must be logged in to save entries.');
      return;
    }

    // Don't save if literally nothing is entered
    if (
      painLevel === null &&
      stressLevel === null &&
      selectedMedicines.length === 0 &&
      selectedFoods.length === 0
    ) {
      openSnackbar('Please enter at least one log (Pain, Stress, Medicine, or Food).');
      return;
    }

    setIsSaving(true);
    
    // Group timing details
    const loggedAt = logDate.toISOString();
    // Local date string format YYYY-MM-DD
    const logDateString = logDate.toLocaleDateString('en-CA'); 

    try {
      if (painLevel !== null) {
        const { error } = await supabase.from('pain_logs').insert({
          user_id: user.id,
          logged_at: loggedAt,
          log_date: logDateString,
          level: painLevel,
        });
        if (error) throw error;
      }

      if (stressLevel !== null) {
        const { error } = await supabase.from('stress_logs').insert({
          user_id: user.id,
          logged_at: loggedAt,
          log_date: logDateString,
          level: stressLevel,
        });
        if (error) throw error;
      }

      if (selectedMedicines.length > 0) {
        const medInserts = selectedMedicines.map((med) => ({
          user_id: user.id,
          medicine_id: med.id,
          logged_at: loggedAt,
          log_date: logDateString,
        }));
        const { error } = await supabase.from('medicine_logs').insert(medInserts);
        if (error) throw error;
      }

      if (selectedFoods.length > 0) {
        const foodInserts = selectedFoods.map((food) => ({
          user_id: user.id,
          food_id: food.id,
          logged_at: loggedAt,
          log_date: logDateString,
        }));
        const { error } = await supabase.from('food_logs').insert(foodInserts);
        if (error) throw error;
      }

      router.back();
    } catch (err: any) {
      openSnackbar(err.message || 'Something went wrong saving your log.');
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder },
  ];

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: colors.text, fontWeight: '700' }}>Add Entry</Text>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>Log your current context and feelings.</Text>
        </View>

        {/* Date & Time Section */}
        <View style={cardStyle}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.text} />
            <Text variant="titleMedium" style={{ color: colors.text }}>Date & Time</Text>
          </View>
          <View style={styles.dateTimeRow}>
            <CustomButton mode="contained-tonal" onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
              {logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </CustomButton>
            <CustomButton mode="contained-tonal" onPress={() => setShowTimePicker(true)} style={styles.dateBtn}>
              {logDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </CustomButton>
          </View>
        </View>

        {/* Pain Section */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderSpaced}>
            <View style={styles.cardHeaderTitle}>
              <MaterialCommunityIcons name="thermometer-lines" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>Pain Level</Text>
            </View>
            {painLevel !== null && (
              <CustomButton mode="text" onPress={() => setPainLevel(null)} compact contentStyle={styles.clearBtnContent} labelStyle={styles.clearBtnText}>
                Clear
              </CustomButton>
            )}
          </View>
          
          <View style={styles.sliderContainer}>
            <Text variant="displaySmall" style={{ color: painLevel ? colors.chartTrigger : colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm, fontWeight: '700' }}>
              {painLevel !== null ? painLevel : '-'}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={painLevel || 1}
              onValueChange={setPainLevel}
              minimumTrackTintColor={colors.chartTrigger}
              maximumTrackTintColor={colors.surfaceContainerHighest}
              thumbTintColor={colors.chartTrigger}
            />
            <View style={styles.sliderLabels}>
              <Text variant="labelSmall" style={{ color: colors.textMuted }}>Mild (1)</Text>
              <Text variant="labelSmall" style={{ color: colors.textMuted }}>Severe (10)</Text>
            </View>
          </View>
        </View>

        {/* Stress Section */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderSpaced}>
            <View style={styles.cardHeaderTitle}>
              <MaterialCommunityIcons name="brain" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>Stress Level</Text>
            </View>
            {stressLevel !== null && (
              <CustomButton mode="text" onPress={() => setStressLevel(null)} compact contentStyle={styles.clearBtnContent} labelStyle={styles.clearBtnText}>
                Clear
              </CustomButton>
            )}
          </View>
          
          <View style={styles.sliderContainer}>
            <Text variant="displaySmall" style={{ color: stressLevel ? colors.chartTrigger : colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm, fontWeight: '700' }}>
              {stressLevel !== null ? stressLevel : '-'}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={stressLevel || 1}
              onValueChange={setStressLevel}
              minimumTrackTintColor={colors.chartTrigger}
              maximumTrackTintColor={colors.surfaceContainerHighest}
              thumbTintColor={colors.chartTrigger}
            />
            <View style={styles.sliderLabels}>
              <Text variant="labelSmall" style={{ color: colors.textMuted }}>Low (1)</Text>
              <Text variant="labelSmall" style={{ color: colors.textMuted }}>High (10)</Text>
            </View>
          </View>
        </View>

        {/* Medicine Section */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderSpaced}>
            <View style={styles.cardHeaderTitle}>
              <MaterialCommunityIcons name="pill" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>Medicine</Text>
            </View>
            <CustomButton mode="text" onPress={() => { setSelectorType('medicine'); setSelectorVisible(true); }} compact>
              + Add
            </CustomButton>
          </View>
          
          {selectedMedicines.map((med, index) => (
            <View key={index} style={styles.selectedItemRow}>
              <Text variant="bodyMedium" style={{ color: colors.text }}>{med.name}</Text>
              <MaterialCommunityIcons 
                name="close" 
                size={20} 
                color={colors.error} 
                onPress={() => setSelectedMedicines(prev => prev.filter((_, i) => i !== index))}
                suppressHighlighting
              />
            </View>
          ))}
          {selectedMedicines.length === 0 && (
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>No medicine selected.</Text>
          )}
        </View>

        {/* Food Section */}
        <View style={cardStyle}>
          <View style={styles.cardHeaderSpaced}>
            <View style={styles.cardHeaderTitle}>
              <MaterialCommunityIcons name="food-apple" size={20} color={colors.text} />
              <Text variant="titleMedium" style={{ color: colors.text }}>Meals & Food</Text>
            </View>
            <CustomButton mode="text" onPress={() => { setSelectorType('food'); setSelectorVisible(true); }} compact>
              + Add
            </CustomButton>
          </View>
          
          {selectedFoods.map((food, index) => (
            <View key={index} style={styles.selectedItemRow}>
              <Text variant="bodyMedium" style={{ color: colors.text }}>{food.name}</Text>
              <MaterialCommunityIcons 
                name="close" 
                size={20} 
                color={colors.error} 
                onPress={() => setSelectedFoods(prev => prev.filter((_, i) => i !== index))}
                suppressHighlighting
              />
            </View>
          ))}
          {selectedFoods.length === 0 && (
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>No food selected.</Text>
          )}
        </View>

        {/* Save Button */}
        <CustomButton
          mode="contained"
          onPress={handleSaveLog}
          isLoading={isSaving}
          style={styles.saveButton}
        >
          Save Entry
        </CustomButton>
      </ScrollView>

      {/* Date Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={logDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={logDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Error / Alert Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: colors.surfaceContainerHighest }}
        theme={{ colors: { onSurface: colors.text } }}
      >
        {snackbarMessage}
      </Snackbar>

      {/* Item Selector Modal */}
      <ItemSelector
        type={selectorType}
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        onSelect={(id, displayName) => {
          if (selectorType === 'medicine') {
            if (!selectedMedicines.find(m => m.id === id)) {
              setSelectedMedicines(prev => [...prev, { id, name: displayName }]);
            }
          } else {
            if (!selectedFoods.find(f => f.id === id)) {
              setSelectedFoods(prev => [...prev, { id, name: displayName }]);
            }
          }
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardHeaderSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateBtn: {
    flex: 1,
  },
  clearBtnContent: {
    minHeight: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  clearBtnText: {
    fontSize: 14,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  selectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: Radius.md,
  },
  sliderContainer: {
    paddingHorizontal: Spacing.xs,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});
