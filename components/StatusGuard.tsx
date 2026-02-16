
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

type StatusGuardProps = {
    children: React.ReactNode;
    type: 'rider' | 'restaurant';
};

export default function StatusGuard({ children, type }: StatusGuardProps) {
    const { user, isReady } = useAuth();
    const [status, setStatus] = useState<'pending' | 'active' | 'rejected' | 'suspended' | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!isReady || !user) return;

        const checkStatus = async () => {
            try {
                const table = type === 'rider' ? 'riders' : 'restaurants';
                const idField = type === 'rider' ? 'user_id' : 'owner_id';

                const { data, error } = await supabase
                    .from(table)
                    .select('status')
                    .eq(idField, user.id)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching status:', error);
                    return;
                }

                if (data) {
                    setStatus(data.status);
                } else {
                    // If no record found, they might not have finished registration
                    // Consider redirecting to registration or just showing pending
                    setStatus(null);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();

        // Optional: Real-time subscription to status changes
        const subscription = supabase
            .channel(`${type}_status_${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: type === 'rider' ? 'riders' : 'restaurants',
                filter: `${type === 'rider' ? 'user_id' : 'owner_id'}=eq.${user.id}`
            }, (payload) => {
                if (payload.new && payload.new.status) {
                    setStatus(payload.new.status);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        }

    }, [user, isReady, type]);

    if (!isReady || loading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" color="#1F2050" />
            </ThemedView>
        );
    }

    if (status === 'active') {
        return <>{children}</>;
    }

    // Default Fallback / Pending State
    return (
        <ThemedView style={styles.container}>
            <View style={styles.content}>
                <Ionicons
                    name={status === 'rejected' ? "close-circle-outline" : "time-outline"}
                    size={80}
                    color={status === 'rejected' ? "#FF3B30" : "#FF9500"}
                />

                <ThemedText type="title" style={styles.title}>
                    {status === 'rejected' ? 'Application Rejected' : 'Under Review'}
                </ThemedText>

                <ThemedText style={styles.message}>
                    {status === 'rejected'
                        ? 'We are sorry, but your application does not meet our requirements at this time.'
                        : 'Your application is currently being reviewed by our team. We will notify you once your account is active.'
                    }
                </ThemedText>

                <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
                    <ThemedText style={styles.buttonText}>Go Back Home</ThemedText>
                </TouchableOpacity>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        gap: 20,
    },
    title: {
        fontSize: 24,
        textAlign: 'center',
        marginTop: 20,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.7,
        lineHeight: 24,
    },
    button: {
        backgroundColor: '#1F2050',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 20,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
