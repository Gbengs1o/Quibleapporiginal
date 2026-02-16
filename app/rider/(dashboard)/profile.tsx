import { Colors } from '@/constants/theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

export default function RiderProfile() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

    const [stats, setStats] = React.useState<{ rating: number; deliveries: number } | null>(null);

    React.useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('riders')
                .select('average_rating, total_deliveries')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setStats({
                    rating: data.average_rating || 5.0,
                    deliveries: data.total_deliveries || 0
                });
            }
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.text, { color: theme.text }]}>Rider Profile & Settings</Text>

            {stats && (
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.rating.toFixed(1)} ★</Text>
                        <Text style={[styles.statLabel, { color: theme.text, opacity: 0.6 }]}>Rating</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.icon }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.deliveries}</Text>
                        <Text style={[styles.statLabel, { color: theme.text, opacity: 0.6 }]}>Deliveries</Text>
                    </View>
                </View>
            )}

            <TouchableOpacity onPress={() => router.push('/profile/feedback')} style={styles.menuItem}>
                <Ionicons name="chatbox-ellipses-outline" size={24} color={theme.text} />
                <Text style={[styles.menuText, { color: theme.text }]}>Help & Feedback</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.icon} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        marginBottom: 20,
    },
    logoutButton: {
        padding: 15,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
    },
    logoutText: {
        color: 'white',
        fontWeight: 'bold',
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 30,
        width: '90%',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        opacity: 0.6,
    },
    divider: {
        width: 1,
        height: '100%',
        backgroundColor: '#ccc',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        width: '90%',
        marginBottom: 15,
        gap: 15,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
});
