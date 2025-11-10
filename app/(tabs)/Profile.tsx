import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileMenuList from '@/components/ProfileMenuList';
import ProfileSupportList from '@/components/ProfileSupportList';
import ProfileActionsList from '@/components/ProfileActionsList';

export default function ProfileScreen() {
  return (
    <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <ProfileHeader />
            <ProfileMenuList />
            <ProfileSupportList />
            <ProfileActionsList />
        </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200, 
  },
});
