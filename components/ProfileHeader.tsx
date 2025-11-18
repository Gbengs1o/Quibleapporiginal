
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Svg, { Path } from 'react-native-svg';
import { User } from '@supabase/supabase-js';

const ProfileHeader = ({ userData }: { userData: User | null }) => {
  return (
    <View style={styles.wrapper}>
      {/* Curved Background */}
      <View style={styles.curvedBackground}>
        <Svg
          height="100%"
          width="100%"
          viewBox="0 0 375 200"
          style={styles.svg}
          preserveAspectRatio="none"
        >
          <Path
            d="M0 0 L375 0 L375 120 Q187.5 200 0 120 Z"
            fill="#1F2050"
          />
        </Svg>
      </View>

      {/* Profile Content */}
      <ThemedView style={styles.container}>
        <View style={styles.profileImageContainer}>
          <Image
            source={{ uri: 'https://via.placeholder.com/150' }}
            style={styles.profileImage}
          />
          {/* Optional badge/icon overlay */}
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>✓</ThemedText>
          </View>
        </View>
        <ThemedText type="title" style={styles.name}>{userData ? `${userData.user_metadata.first_name} ${userData.user_metadata.last_name}` : 'Guest'}</ThemedText>
        <ThemedText style={styles.memberSince}>Member since 2024</ThemedText>
      </ThemedView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    height: 280,
    backgroundColor: '#f5f5f5',
  },
  curvedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    overflow: 'hidden',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  container: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  badge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  name: {
    fontWeight: 'bold',
    fontSize: 24,
    marginBottom: 4,
  },
  memberSince: {
    color: '#888',
    fontSize: 14,
  },
});

export default ProfileHeader;