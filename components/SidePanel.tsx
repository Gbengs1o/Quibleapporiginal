import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  TouchableWithoutFeedback,
  Image,
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
  profile: any;
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, profile }) => {
  const { theme, toggleTheme } = useTheme();
  const panelBackgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const router = useRouter();
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
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
            {profile ? (
              <View style={styles.profileContainer}>
                <Image source={{ uri: profile.profile_picture_url }} style={styles.profileImage} />
                <ThemedText style={styles.profileName}>{`${profile.first_name} ${profile.last_name}`}</ThemedText>
              </View>
            ) : (
              <View style={styles.logoContainer}>
                <QuibbleLogo width={80} height={80} />
              </View>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={toggleDropdown}
              >
                <ThemedText>Register a service or business</ThemedText>
              </TouchableOpacity>
              {isDropdownOpen && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleNavigate('join-restaurant')}
                  >
                    <ThemedText>Restaurant</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleNavigate('join-rider')}
                  >
                    <ThemedText>Quible rider</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleNavigate('join-store')}
                  >
                    <ThemedText>Store</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleNavigate('join-handyman')}
                  >
                    <ThemedText>Handyman</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
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
    zIndex: 1000, // Ensure overlay is on top
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
  profileContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40, // Add margin to avoid status bar overlap
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  dropdown: {
    marginTop: 10,
    paddingLeft: 15,
  },
  dropdownItem: {
    paddingVertical: 10,
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
