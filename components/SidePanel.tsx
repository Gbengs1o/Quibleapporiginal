import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuibbleLogo from './QuibbleLogo';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

// Available services to register
const AVAILABLE_SERVICES = [
  { key: 'restaurant', label: 'Restaurant', icon: 'restaurant', route: 'join-restaurant', color: '#E91E63' },
  { key: 'rider', label: 'Quible Rider', icon: 'bicycle', route: '/rider/register/step1-personal', color: '#F4821F' },
  { key: 'store', label: 'Store', icon: 'storefront', route: 'join-store', color: '#9C27B0' },
  { key: 'handyman', label: 'Handyman', icon: 'construct', route: 'join-handyman', color: '#2196F3' },
];

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, profile }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const panelBackgroundColor = useThemeColor({ light: '#FAFAFA', dark: '#121212' }, 'background');
  const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');
  const borderColor = isDark ? '#333' : '#E0E0E0';
  const subtleText = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [isAddServiceOpen, setAddServiceOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [rider, setRider] = useState<{ id: string; status: string; rider_photo: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([checkRestaurantStatus(), checkRiderStatus()]).finally(() => setLoading(false));
    } else {
      setRestaurant(null);
      setRider(null);
      setLoading(false);
    }
  }, [user]);

  const checkRiderStatus = async () => {
    try {
      const { data } = await supabase
        .from('riders')
        .select('id, status, rider_photo')
        .eq('user_id', user?.id)
        .single();
      if (data) setRider(data);
    } catch (error) {
      // No rider registered
    }
  };

  const checkRestaurantStatus = async () => {
    try {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('owner_id', user?.id)
        .single();
      if (data) setRestaurant(data);
    } catch (error) {
      // No restaurant registered
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path as any);
    onClose();
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    router.replace('/');
  };

  const hasAnyBusiness = restaurant || rider;
  const registeredKeys = [
    ...(restaurant ? ['restaurant'] : []),
    ...(rider ? ['rider'] : []),
  ];
  const availableToRegister = AVAILABLE_SERVICES.filter(s => !registeredKeys.includes(s.key));

  // Quick Actions
  const quickActions = [
    { icon: 'cart-outline', label: 'Orders', route: '/(tabs)/Orders' },
    { icon: 'wallet-outline', label: 'Wallet', route: '/wallet' },
    { icon: 'heart-outline', label: 'Favorites', route: '/favorites' },
    { icon: 'help-circle-outline', label: 'Help', route: '/(tabs)/Support' },
  ];

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
        onPressOut={onClose}
      >
        <TouchableWithoutFeedback>
          <ThemedView style={[styles.panel, { backgroundColor: panelBackgroundColor }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

                {/* Profile Header */}
                <View style={styles.profileSection}>
                  {profile ? (
                    <TouchableOpacity style={styles.profileRow} onPress={() => handleNavigate('/(tabs)/Profile')}>
                      <Image source={{ uri: profile.profile_picture_url || 'https://via.placeholder.com/80' }} style={styles.profileImage} />
                      <View style={styles.profileInfo}>
                        <ThemedText style={styles.profileName}>{`${profile.first_name || ''} ${profile.last_name || ''}`}</ThemedText>
                        <ThemedText style={[styles.profileEmail, { color: subtleText }]}>{user?.email}</ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={subtleText} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.logoContainer}>
                      <QuibbleLogo width={60} height={60} />
                      <ThemedText style={styles.brandName}>Quible</ThemedText>
                    </View>
                  )}
                </View>

                {/* Your Businesses Section */}
                {user && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Your Businesses</ThemedText>
                      {availableToRegister.length > 0 && (
                        <TouchableOpacity
                          style={[styles.addButton, { backgroundColor: '#F4821F' }]}
                          onPress={() => setAddServiceOpen(!isAddServiceOpen)}
                        >
                          <Ionicons name={isAddServiceOpen ? 'close' : 'add'} size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#F4821F" />
                      </View>
                    ) : !hasAnyBusiness && !isAddServiceOpen ? (
                      <TouchableOpacity
                        style={[styles.emptyBusinessCard, { backgroundColor: cardBg, borderColor }]}
                        onPress={() => setAddServiceOpen(true)}
                      >
                        <Ionicons name="briefcase-outline" size={32} color={subtleText} />
                        <ThemedText style={[styles.emptyText, { color: subtleText }]}>
                          Start earning with Quible
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtext, { color: subtleText }]}>
                          Register your business or become a rider
                        </ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.businessList}>
                        {/* Registered Restaurant */}
                        {restaurant && (
                          <TouchableOpacity
                            style={[styles.businessCard, { backgroundColor: cardBg, borderColor }]}
                            onPress={() => handleNavigate('/restaurant/dashboard')}
                          >
                            <View style={[styles.businessIcon, { backgroundColor: '#FCE4EC' }]}>
                              {restaurant.logo_url ? (
                                <Image source={{ uri: restaurant.logo_url }} style={styles.businessLogo} />
                              ) : (
                                <Ionicons name="restaurant" size={24} color="#E91E63" />
                              )}
                            </View>
                            <View style={styles.businessInfo}>
                              <ThemedText style={styles.businessName}>{restaurant.name}</ThemedText>
                              <ThemedText style={[styles.businessType, { color: subtleText }]}>Restaurant</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={subtleText} />
                          </TouchableOpacity>
                        )}

                        {/* Registered Rider */}
                        {rider && (
                          <TouchableOpacity
                            style={[styles.businessCard, { backgroundColor: cardBg, borderColor }]}
                            onPress={() => handleNavigate('/rider/(dashboard)')}
                          >
                            <View style={[styles.businessIcon, { backgroundColor: '#FFF3E0' }]}>
                              {rider.rider_photo ? (
                                <Image source={{ uri: rider.rider_photo }} style={styles.businessLogo} />
                              ) : (
                                <Ionicons name="bicycle" size={24} color="#F4821F" />
                              )}
                            </View>
                            <View style={styles.businessInfo}>
                              <ThemedText style={styles.businessName}>Rider Dashboard</ThemedText>
                              <View style={styles.statusBadge}>
                                <View style={[styles.statusDot, { backgroundColor: rider.status === 'active' ? '#4CAF50' : '#999' }]} />
                                <ThemedText style={[styles.businessType, { color: subtleText }]}>
                                  {rider.status === 'active' ? 'Active' : 'Pending'}
                                </ThemedText>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={subtleText} />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Add New Service Dropdown */}
                    {isAddServiceOpen && availableToRegister.length > 0 && (
                      <View style={[styles.addServiceContainer, { backgroundColor: cardBg, borderColor }]}>
                        <ThemedText style={[styles.addServiceTitle, { color: subtleText }]}>
                          Add a new service
                        </ThemedText>
                        {availableToRegister.map((service) => (
                          <TouchableOpacity
                            key={service.key}
                            style={styles.serviceOption}
                            onPress={() => {
                              setAddServiceOpen(false);
                              handleNavigate(service.route);
                            }}
                          >
                            <View style={[styles.serviceIconCircle, { backgroundColor: service.color + '20' }]}>
                              <Ionicons name={service.icon as any} size={20} color={service.color} />
                            </View>
                            <ThemedText style={styles.serviceLabel}>{service.label}</ThemedText>
                            <Ionicons name="add-circle-outline" size={22} color={service.color} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Quick Actions */}
                {user && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
                    <View style={styles.quickActionsGrid}>
                      {quickActions.map((action, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.quickActionButton, { backgroundColor: cardBg, borderColor }]}
                          onPress={() => handleNavigate(action.route)}
                        >
                          <Ionicons name={action.icon as any} size={22} color="#F4821F" />
                          <ThemedText style={styles.quickActionLabel}>{action.label}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Not Logged In */}
                {!user && (
                  <View style={styles.section}>
                    <TouchableOpacity
                      style={styles.signInButton}
                      onPress={() => handleNavigate('/login')}
                    >
                      <Ionicons name="log-in-outline" size={22} color="#fff" />
                      <ThemedText style={styles.signInText}>Sign In</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.createAccountButton, { borderColor }]}
                      onPress={() => handleNavigate('/signup')}
                    >
                      <ThemedText style={styles.createAccountText}>Create Account</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

              </ScrollView>

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: borderColor }]}>
                {/* Theme Toggle */}
                <View style={styles.themeRow}>
                  <View style={styles.themeInfo}>
                    <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color="#F4821F" />
                    <ThemedText style={styles.themeLabel}>{isDark ? 'Dark Mode' : 'Light Mode'}</ThemedText>
                  </View>
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#ccc', true: '#F4821F' }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Sign Out */}
                {user && (
                  <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={20} color="#F44336" />
                    <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
                  </TouchableOpacity>
                )}

                {/* Version */}
                <ThemedText style={[styles.versionText, { color: subtleText }]}>Quible v1.0.0</ThemedText>
              </View>
            </SafeAreaView>
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
    width: '82%',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  profileSection: {
    padding: 20,
    paddingTop: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F4821F',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyBusinessCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  businessList: {
    gap: 10,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  businessIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  businessInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
  },
  businessType: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addServiceContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  addServiceTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  serviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionButton: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4821F',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createAccountButton: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  createAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F4821F',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#F44336',
    fontSize: 15,
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default SidePanel;
