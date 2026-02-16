import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useTheme } from '@/hooks/use-theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

export default function RiderSettings() {
    const { openMenu } = useRiderMenu();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1E1E1E' }, 'background');

    const settingsItems = [
        { icon: 'person-outline', label: 'Edit Profile', route: '/edit-profile' },
        { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
        { icon: 'shield-checkmark-outline', label: 'Privacy', route: '/privacy' },
        { icon: 'document-text-outline', label: 'Documents', route: '/documents' },
    ];

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={openMenu}>
                    <Ionicons name="menu" size={28} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Profile & Settings</ThemedText>
                <View style={{ width: 28 }} />
            </View>
            <View style={styles.content}>
                {settingsItems.map((item, index) => (
                    <TouchableOpacity key={index} style={[styles.settingRow, { backgroundColor: cardBg }]}>
                        <Ionicons name={item.icon as any} size={22} color="#F27C22" />
                        <ThemedText style={styles.settingLabel}>{item.label}</ThemedText>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </TouchableOpacity>
                ))}
                <View style={[styles.settingRow, { backgroundColor: cardBg }]}>
                    <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={22} color="#F27C22" />
                    <ThemedText style={[styles.settingLabel, { flex: 1 }]}>Dark Mode</ThemedText>
                    <Switch
                        value={theme === 'dark'}
                        onValueChange={toggleTheme}
                        trackColor={{ false: '#ccc', true: '#F27C22' }}
                        thumbColor="#fff"
                    />
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: {
        flex: 1,
        padding: 20,
        gap: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 14,
    },
    settingLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
});
