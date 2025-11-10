import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import QuibbleLogo from './QuibbleLogo';
import { useRouter } from 'expo-router';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme();
  const panelBackgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <Modal
      transparent={true}
      visible={isOpen}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPressOut={onClose} // Close when tapping outside
      >
        <TouchableWithoutFeedback>
          <ThemedView style={[styles.panel, { backgroundColor: panelBackgroundColor }]}>
            <View style={styles.logoContainer}>
              <QuibbleLogo />
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigate('join-restaurant')}
              >
                <ThemedText>Join as a restaurant owner</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigate('join-rider')}
              >
                <ThemedText>Join as a Quible rider</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.themeToggleContainer}>
              <ThemedText>Dark Mode</ThemedText>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
            </View>
          </ThemedView>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '75%',
    padding: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40, // Add margin to avoid status bar overlap
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
});

export default SidePanel;
