import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function PaymentsScreen() {
    const navigation = useNavigation();
    const { openMenu } = useRestaurantMenu();
    const iconColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return <FoodLoader message="Loading earnings..." />;
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText type="title">Payments & Earnings</ThemedText>
                <View style={{ width: 24 }} />
            </View>
            <View style={styles.content}>
                <Ionicons name="wallet-outline" size={60} color="#ccc" />
                <ThemedText style={styles.placeholderText}>Payments and Earnings content coming soon...</ThemedText>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        gap: 15,
    },
    placeholderText: {
        fontSize: 16,
        opacity: 0.6,
        textAlign: 'center',
    },
});
