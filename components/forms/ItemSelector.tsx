import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, List, IconButton, ActivityIndicator, Snackbar, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppColors } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Radius, Spacing } from '../../constants/theme';
import { ScreenWrapper } from '../ui/ScreenWrapper';
import { CustomButton } from '../ui/CustomButton';
import { CustomTextInput } from '../ui/CustomTextInput';

interface Item {
  id: string;
  display_name: string;
  name?: string;
  quantity?: number;
  unit?: string;
}

interface ItemSelectorProps {
  type: 'medicine' | 'food';
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string, displayName: string) => void;
}

export function ItemSelector({ type, visible, onClose, onSelect }: ItemSelectorProps) {
  const colors = useAppColors();
  const { user } = useAuth();
  
  // States
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Entry States
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Snackbar
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const tableName = type === 'medicine' ? 'user_medicines' : 'user_foods';
  const iconName = type === 'medicine' ? 'pill' : 'food-apple';
  const displayType = type === 'medicine' ? 'Medicine' : 'Food';

  useEffect(() => {
    if (visible && user) {
      fetchItems();
    } else {
      // Reset form states when closed
      setSearchQuery('');
      setShowNewEntryForm(false);
      setNewName('');
      setNewQuantity('');
      setNewUnit('');
    }
  }, [visible, user]);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('display_name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      showError(err.message || 'Error fetching items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewItem = async () => {
    if (!user) return;
    if (!newName.trim()) {
      showError('Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          user_id: user.id,
          name: newName.trim(),
          quantity: newQuantity ? parseFloat(newQuantity) : null,
          unit: newUnit.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setItems(prev => [...prev, data].sort((a, b) => 
          (a.display_name || '').localeCompare(b.display_name || '')
        ));
        onSelect(data.id, data.display_name);
        handleClose();
      }
    } catch (err: any) {
      showError(err.message || 'Error saving new item');
    } finally {
      setIsSaving(false);
    }
  };

  const showError = (msg: string) => {
    setSnackbarMessage(msg);
    setSnackbarVisible(true);
  };

  const handleClose = () => {
    setShowNewEntryForm(false);
    onClose();
  };

  const handleOpenNewForm = () => {
    setNewName(searchQuery);
    setShowNewEntryForm(true);
  };

  const filteredItems = items.filter(item => 
    item.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: Item }) => (
    <List.Item
      title={item.display_name}
      titleStyle={{ color: colors.text }}
      style={[
        styles.listItem,
        { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }
      ]}
      left={props => <List.Icon {...props} icon={iconName} color={colors.primary} />}
      onPress={() => {
        onSelect(item.id, item.display_name);
        handleClose();
      }}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <ScreenWrapper>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <IconButton
                icon="close"
                iconColor={colors.text}
                size={24}
                onPress={handleClose}
                style={styles.closeButton}
              />
              <Text variant="titleLarge" style={{ color: colors.text, fontWeight: '700' }}>
                Select {displayType}
              </Text>
            </View>
          </View>

          {!showNewEntryForm ? (
            <View style={styles.content}>
              <CustomTextInput
                placeholder={`Search ${displayType.toLowerCase()}...`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                left={<TextInput.Icon icon="magnify" color={colors.textMuted} />}
              />
              
              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={filteredItems}
                  keyExtractor={item => item.id}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                        No results found.
                      </Text>
                      <CustomButton
                        mode="outlined"
                        onPress={handleOpenNewForm}
                        icon="plus"
                        style={{ marginTop: Spacing.md }}
                      >
                        Add New "{searchQuery || displayType}"
                      </CustomButton>
                    </View>
                  }
                  ListFooterComponent={
                    filteredItems.length > 0 ? (
                      <View style={styles.footerContainer}>
                        <CustomButton
                          mode="outlined"
                          onPress={handleOpenNewForm}
                          icon="plus"
                        >
                          Add New "{searchQuery || displayType}"
                        </CustomButton>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>
          ) : (
            <View style={styles.content}>
              <View style={[styles.newFormCard, { backgroundColor: colors.glassSurface, borderColor: colors.ghostBorder }]}>
                <Text variant="titleMedium" style={{ color: colors.text, marginBottom: Spacing.md }}>
                  Create New {displayType}
                </Text>
                
                <View style={styles.formSpacing}>
                  <CustomTextInput
                    label="Name"
                    placeholder={`e.g. ${type === 'medicine' ? 'Ibuprofen' : 'Apple'}`}
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <View style={styles.row}>
                    <View style={styles.halfWidth}>
                      <CustomTextInput
                        label="Quantity"
                        placeholder="e.g. 400"
                        value={newQuantity}
                        onChangeText={setNewQuantity}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.halfWidth}>
                      <CustomTextInput
                        label="Unit"
                        placeholder={`e.g. ${type === 'medicine' ? 'mg' : 'piece'}`}
                        value={newUnit}
                        onChangeText={setNewUnit}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <CustomButton
                    mode="text"
                    onPress={() => setShowNewEntryForm(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton
                    mode="contained"
                    onPress={handleAddNewItem}
                    isLoading={isSaving}
                    style={styles.saveBtn}
                  >
                    Save & Select
                  </CustomButton>
                </View>
              </View>
            </View>
          )}

          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={{ backgroundColor: colors.surfaceContainerHighest }}
            theme={{ colors: { onSurface: colors.text } }}
          >
            {snackbarMessage}
          </Snackbar>
        </KeyboardAvoidingView>
      </ScreenWrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    marginRight: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  listContent: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  listItem: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginVertical: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  footerContainer: {
    marginTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  newFormCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  formSpacing: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});