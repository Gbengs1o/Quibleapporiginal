import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { Link } from 'expo-router';

const ProfileSupportList = () => {
  const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const containerBgColor = useThemeColor({ light: 'rgba(31, 32, 80, 0.08)', dark: 'rgba(31, 32, 80, 0.4)' });
  const separatorColor = useThemeColor({ light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.1)' });

  const menuItems = [
    {
      title: 'FAQs',
      icon: <FontAwesome name="question-circle-o" size={24} color={iconColor} />,
      href: '/faqs' as const,
    },
    {
      title: 'Contact Support',
      icon: <MaterialCommunityIcons name="headset" size={24} color={iconColor} />,
      href: '/contact-support' as const,
    },
    {
      title: 'Help and feedback',
      icon: <Ionicons name="help-buoy-outline" size={24} color={iconColor} />,
      href: '/help-and-feedback' as const,
    },
    {
        title: 'Invite a friend',
        icon: <Feather name="user-plus" size={24} color={iconColor} />,
        href: '/invite-a-friend' as const,
    }
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

export default ProfileSupportList;
