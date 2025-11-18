
import React from 'react';
import { StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileMenuList from '@/components/ProfileMenuList';
import ProfileSupportList from '@/components/ProfileSupportList';
import ProfileActionsList from '@/components/ProfileActionsList';
import { useAuth } from '@/hooks/use-auth.tsx';

export default function ProfileScreen() {
    const { user, signOut, session } = useAuth();

    if (!session) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <ProfileHeader userData={user} />
                <ProfileMenuList isLoggedIn={!!user} />
                <ProfileSupportList />
                <ProfileActionsList isLoggedIn={!!user} onLogout={signOut} />
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 200, 
  },
});
