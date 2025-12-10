import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import QuibbleLogo from './QuibbleLogo';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, profile }) => {
  const { theme, toggleTheme } = useTheme();
  const panelBackgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const router = useRouter();
  const { user } = useAuth();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    if (user) {
      checkRestaurantStatus();
    } else {
      setRestaurant(null);
    }
  }, [user]);

  const checkRestaurantStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('owner_id', user?.id)
        .single();

      if (data) {
        setRestaurant(data);
      }
    } catch (error) {
      console.log('Error checking restaurant status:', error);
    }
  };

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
              {/* Show when logged in */}
              {user ? (
                <>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={toggleDropdown}
                  >
                    <ThemedText>Register a service or business</ThemedText>
                  </TouchableOpacity>
                  {restaurant && (
                    <TouchableOpacity
                      style={styles.restaurantButton}
                      onPress={() => handleNavigate('/restaurant/dashboard')}
                    >
                      <View style={styles.restaurantInfo}>
                        {restaurant.logo_url ? (
                          <Image
                            source={{ uri: restaurant.logo_url }}
                            style={styles.restaurantLogo}
                          />
                        ) : (
                          <View style={styles.restaurantLogoPlaceholder}>
                            <ThemedText style={styles.restaurantLogoText}>
                              {restaurant.name?.[0]?.toUpperCase() || 'R'}
                            </ThemedText>
                          </View>
                        )}
                        <View style={styles.restaurantTextContainer}>
                          <ThemedText style={styles.restaurantName}>{restaurant.name}</ThemedText>
                          <ThemedText style={styles.restaurantLabel}>Your Restaurant</ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  {isDropdownOpen && (
                    <View style={styles.dropdown}>
                      {!restaurant && (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => handleNavigate('join-restaurant')}
                        >
                          <ThemedText>Restaurant</ThemedText>
                        </TouchableOpacity>
                      )}
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
                </>
              ) : (
                /* Show when not logged in */
                <TouchableOpacity
                  style={styles.createAccountButton}
                  onPress={() => handleNavigate('/signup')}
                >
                  <ThemedText style={styles.createAccountText}>
                    Create account to have full access
                  </ThemedText>
                </TouchableOpacity>
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
  restaurantButton: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restaurantLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  restaurantLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f27c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantLogoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restaurantTextContainer: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  restaurantLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  createAccountButton: {
    paddingVertical: 20,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(242, 124, 34, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  createAccountText: {
    color: '#f27c22',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SidePanel;
