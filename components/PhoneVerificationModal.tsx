import { useAuth } from '@/contexts/auth';
import { useOrders } from '@/contexts/order';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

export default function PhoneVerificationModal() {
    const { user } = useAuth();
    const { activeOrders } = useOrders();
    const router = useRouter();
    const segments = useSegments();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Theme colors
    const bgColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');
    const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
    const primary = '#F27C22';

    useEffect(() => {
        if (!user) return;

        // Reset dismissed state when segments change (navigation happens)
        // This means if they navigate away, the modal is allowed to pop up again
        // matching the "keeps appearing" requirement.
        setDismissed(false);
        checkPhoneRequirement();

        // Check periodically
        const interval = setInterval(checkPhoneRequirement, 30000);

        return () => clearInterval(interval);
    }, [user, activeOrders, segments]);

    const checkPhoneRequirement = async () => {
        if (!user || checking || dismissed) return;

        // Don't show if already on profile edit page
        const currentRoute = segments[segments.length - 1];
        if (currentRoute === 'edit-profile') {
            setVisible(false);
            return;
        }

        setChecking(true);
        try {
            // 1. Check if user has phone number
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('phone_number, role')
                .eq('id', user.id)
                .single();

            if (error || !profile) {
                setChecking(false);
                return;
            }

            if (profile.phone_number && profile.phone_number.trim().length > 0) {
                // User has phone number, all good
                setVisible(false);
                setChecking(false);
                return;
            }

            // 2. User has NO phone number. Check if they have an active task.

            // A. Customer: Active Orders
            if (activeOrders.length > 0) {
                setVisible(true);
                setChecking(false);
                return;
            }

            // B. Rider: Active Deliveries
            if (profile.role === 'rider') {
                const { count } = await supabase
                    .from('delivery_requests')
                    .select('*', { count: 'exact', head: true })
                    .eq('rider_id', user.id)
                    .neq('status', 'delivered')
                    .neq('status', 'cancelled');

                if (count && count > 0) {
                    setVisible(true);
                    setChecking(false);
                    return;
                }
            }

            // No active tasks found
            setVisible(false);

        } catch (err) {
            console.error('Error in phone check:', err);
        } finally {
            setChecking(false);
            setLoading(false);
        }
    };

    const handleGoToProfile = () => {
        setVisible(false);
        // Correct route for editing profile
        router.push('/edit-profile');
    };

    const handleDismiss = () => {
        setVisible(false);
        setDismissed(true);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: bgColor }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="call" size={32} color={primary} />
                    </View>

                    <ThemedText type="subtitle" style={styles.title}>
                        Phone Number Required
                    </ThemedText>

                    <ThemedText style={[styles.message, { color: textColor + 'cc' }]}>
                        You have an active order. To ensure successful delivery and communication, please add your phone number to your profile.
                    </ThemedText>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: primary }]}
                        onPress={handleGoToProfile}
                    >
                        <ThemedText style={styles.buttonText}>Add Phone Number</ThemedText>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.dismissButton}
                        onPress={handleDismiss}
                    >
                        <ThemedText style={[styles.dismissText, { color: textColor + '80' }]}>
                            Not Now
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F27C2220',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    dismissButton: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    dismissText: {
        fontSize: 14,
        fontWeight: '600',
    }
});
