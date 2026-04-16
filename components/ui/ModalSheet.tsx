import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Radius, Spacing } from "../../constants/theme";
import { useAppColors } from "../../providers/ThemeProvider";

interface ModalSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  animationType?: ModalProps["animationType"];
  backdropColor?: string;
  handleColor?: string;
  sheetStyle?: StyleProp<ViewStyle>;
  keyboardAvoidingStyle?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  dismissOnBackdropPress?: boolean;
  statusBarTranslucent?: boolean;
}

export function ModalSheet({
  visible,
  onRequestClose,
  children,
  animationType = "slide",
  backdropColor,
  handleColor,
  sheetStyle,
  keyboardAvoidingStyle,
  showHandle = true,
  dismissOnBackdropPress = true,
  statusBarTranslucent = true,
}: ModalSheetProps) {
  const colors = useAppColors();

  const handleBackdropPress = dismissOnBackdropPress
    ? onRequestClose
    : () => {};

  return (
    <Modal
      transparent
      animationType={animationType}
      visible={visible}
      onRequestClose={onRequestClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: backdropColor ?? colors.shadowAmbient },
          ]}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={[styles.keyboardAvoidingContainer, keyboardAvoidingStyle]}
            >
              <View
                style={[
                  styles.sheetBackground,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.ghostBorder,
                  },
                  sheetStyle,
                ]}
              >
                {showHandle ? (
                  <View
                    style={[
                      styles.handleIndicator,
                      { backgroundColor: handleColor ?? colors.outlineVariant },
                    ]}
                  />
                ) : null}
                {children}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardAvoidingContainer: {
    width: "100%",
    maxHeight: "90%",
    justifyContent: "flex-end",
  },
  sheetBackground: {
    height: "100%",
    minHeight: 320,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: Spacing.md,
  },
  handleIndicator: {
    width: 48,
    height: 5,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
});
