
import { useThemeColor } from '@/hooks/use-theme-color';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const ProfileActionsList = ({ isLoggedIn, onLogout }: { isLoggedIn: boolean, onLogout: () => void }) => {
  const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const containerBgColor = useThemeColor({ light: 'rgba(31, 32, 80, 0.08)', dark: 'rgba(31, 32, 80, 0.4)' });

  if (!isLoggedIn) {
    return null;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: containerBgColor }]}>
      <TouchableOpacity style={styles.menuItem} onPress={onLogout}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={styles.iconContainer}>
            <Feather name="log-out" size={24} color={iconColor} />
          </View>
          <ThemedText style={styles.menuText}>Logout</ThemedText>
          <Feather name="chevron-right" size={24} color={iconColor} />
        </View>
      </TouchableOpacity>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 14,
    marginTop: 30,
    marginBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 15,
  },
  iconContainer: {
    marginRight: 20,
  },
  menuText: {
    flex: 1,
    fontSize: 18,
  },
});

export default ProfileActionsList;
