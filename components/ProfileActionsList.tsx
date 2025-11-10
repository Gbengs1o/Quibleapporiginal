import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

const ProfileActionsList = () => {
  const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const containerBgColor = useThemeColor({ light: 'rgba(31, 32, 80, 0.08)', dark: 'rgba(31, 32, 80, 0.4)' });
  const separatorColor = useThemeColor({ light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.1)' });

  const menuItems = [
    {
      title: 'Login',
      icon: <Feather name="log-in" size={24} color={iconColor} />,
      href: '/login' as const,
    },
    {
      title: 'Sign Up',
      icon: <Ionicons name="person-add-outline" size={24} color={iconColor} />,
      href: '/signup' as const,
    },
    {
      title: 'Forgot Password',
      icon: <Ionicons name="key-outline" size={24} color={iconColor} />,
      href: '/forgot-password' as const,
    },
    {
      title: 'Change password',
      icon: <Ionicons name="lock-closed-outline" size={24} color={iconColor} />,
      href: '/change-password' as const,
    },
    {
      title: 'Logout',
      icon: <Feather name="log-out" size={24} color={iconColor} />,
      href: '/login' as const,
    },
  ];

  return (
    <ThemedView style={[styles.container, { backgroundColor: containerBgColor }]}>
      {menuItems.map((item, index) => (
        <React.Fragment key={item.title}>
          <Link href={item.href} asChild>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.iconContainer}>{item.icon}</View>
              <ThemedText style={styles.menuText}>{item.title}</ThemedText>
              <Feather name="chevron-right" size={24} color={iconColor} />
            </TouchableOpacity>
          </Link>
          {index < menuItems.length - 1 && <View style={[styles.separator, { backgroundColor: separatorColor }]} />}
        </React.Fragment>
      ))}
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 15,
  },
});

export default ProfileActionsList;
