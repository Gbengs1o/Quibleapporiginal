
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';

interface UserData {
    id: number;
    name: string;
    email: string;
    phone: string;
}

const EditProfileScreen = () => {
    const router = useRouter();
    const [userData, setUserData] = useState<UserData | null>(null);
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const storedUserData = await AsyncStorage.getItem('userData');
                if (storedUserData && storedUserData.length > 0) {
                    setUserData(JSON.parse(storedUserData));
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to fetch user data.');
            }
        };

        fetchUserData();
    }, []);

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('userData');
            router.replace('/login');
        } catch (error) {
            Alert.alert('Error', 'Failed to log out.');
        }
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <ThemedText type="title" style={{ color: labelColor }}>Edit Profile</ThemedText>
            {userData && (
                <View style={styles.userInfoContainer}>
                    <ThemedText style={[styles.label, { color: labelColor }]}>Name:</ThemedText>
                    <ThemedText style={[styles.value, { color: labelColor }]}>{userData.name}</ThemedText>
                    <ThemedText style={[styles.label, { color: labelColor }]}>Email:</ThemedText>
                    <ThemedText style={[styles.value, { color: labelColor }]}>{userData.email}</ThemedText>
                    <ThemedText style={[styles.label, { color: labelColor }]}>Phone:</ThemedText>
                    <ThemedText style={[styles.value, { color: labelColor }]}>{userData.phone}</ThemedText>
                </View>
            )}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    userInfoContainer: {
        marginTop: 30,
        alignItems: 'flex-start',
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
        marginBottom: 5,
    },
    value: {
        fontSize: 18,
        fontFamily: 'OpenSans_400Regular',
        marginBottom: 20,
    },
    logoutButton: {
        backgroundColor: '#FF3B30',
        borderRadius: 28,
        paddingVertical: 16,
        paddingHorizontal: 30,
        alignItems: 'center',
        marginTop: 40,
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: 0.5,
    },
});

export default EditProfileScreen;
