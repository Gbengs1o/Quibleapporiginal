
import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileMenuList from '@/components/ProfileMenuList';
import ProfileSupportList from '@/components/ProfileSupportList';
import ProfileActionsList from '@/components/ProfileActionsList';
import { useAuth } from '@/contexts/auth';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';

const GuestProfileView = () => {
    const router = useRouter();

    return (
        <ThemedView style={styles.guestContainer}>
            <ThemedText type="title" style={styles.guestTitle}>Explore the App</ThemedText>
            <ThemedText style={styles.guestText}>
                Create an account or sign in to get the full experience.
            </ThemedText>
            <View style={styles.guestButtons}>
                <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/login')}>
                    <Text style={styles.buttonText}>Sign In</Text>
                </TouchableOpacity>
                <View style={{ width: 10 }} />
                <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/signup')}>
                     <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>
            </View>
        </ThemedView>
    );
};

const ProfileScreen = () => {
    const { user, signOut, session, isReady } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            if (user) {
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    if (error) throw error;
                    setProfile(data);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setProfile(null);
                setLoading(false);
            }
        };

        if (isReady) {
            fetchProfile();
        }
    }, [user, isReady]);

    if (loading || !isReady) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <ProfileHeader userData={session ? profile : null} />
                { !session && <GuestProfileView /> }
                { session && <ProfileMenuList isLoggedIn={!!user} /> }
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
  scrollContent: {
    paddingBottom: 200, 
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestContainer: {
    padding: 20,
    alignItems: 'center',
  },
  guestTitle: {
    marginBottom: 10,
  },
  guestText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  guestButtons: {
    flexDirection: 'row',
  },
  button: {
    backgroundColor: '#1F2050',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#1F2050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;
