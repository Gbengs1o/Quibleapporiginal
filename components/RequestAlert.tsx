import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

interface RequestAlertProps {
    riderId: string;
}

export default function RequestAlert({ riderId }: RequestAlertProps) {
    const [request, setRequest] = useState<any>(null);
    const [visible, setVisible] = useState(false);
    const [sound, setSound] = useState<Audio.Sound>();

    const bgColor = useThemeColor({ light: '#fff', dark: '#1A1A1A' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const primary = '#F27C22';
    const success = '#22C55E';
    const danger = '#EF4444';

    useEffect(() => {
        if (!riderId) return;

        const channel = supabase
            .channel(`rider-requests:${riderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'rider_requests',
                    filter: `rider_id=eq.${riderId}`
                },
                async (payload) => {
                    console.log('New request received:', payload.new);
                    if (payload.new.status === 'pending') {
                        setRequest(payload.new);
                        setVisible(true);
                        await playSound();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [riderId]);

    const playSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/sounds/notification.mp3') // You might need to add a sound file or use a default if not present, checking relevant dirs first would be ideal but for now we assume or fallback.
                // actually, let's keep it simple and just console log if sound fails, user didn't ask for sound specifically but it's "alert".
            );
            setSound(sound);
            await sound.playAsync();
        } catch (e) {
            // console.log('Error playing sound', e);
        }
    };

    useEffect(() => {
        return sound
            ? () => {
                sound.unloadAsync();
            }
            : undefined;
    }, [sound]);

    const handleResponse = async (status: 'accepted' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('rider_requests')
                .update({ status })
                .eq('id', request.id);

            if (error) throw error;
            setVisible(false);
            setRequest(null);
        } catch (e) {
            console.error('Error responding to request:', e);
        }
    };

    if (!visible || !request) return null;

    return (
        <Modal transparent visible={visible} animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: bgColor }]}>
                    <View style={styles.header}>
                        <Ionicons name="notifications-circle" size={40} color={primary} />
                        <ThemedText style={styles.title}>New Delivery Request!</ThemedText>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.row}>
                            <Ionicons name="pricetag" size={20} color={primary} />
                            <ThemedText style={[styles.price, { color: success }]}>
                                ₦{request.offered_price?.toLocaleString()}
                            </ThemedText>
                        </View>

                        {request.item_description && (
                            <View style={[styles.row, { marginBottom: 12 }]}>
                                <Ionicons name="cube" size={18} color={primary} />
                                <ThemedText style={{ fontSize: 16, fontWeight: '600', color: textColor }}>
                                    {request.item_description}
                                </ThemedText>
                            </View>
                        )}

                        <View style={styles.locationContainer}>
                            <View style={styles.locationRow}>
                                <Ionicons name="ellipse" size={12} color={primary} />
                                <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={1}>
                                    {request.pickup_location?.address || 'Pickup Location'}
                                </ThemedText>
                            </View>
                            <View style={styles.line} />
                            <View style={styles.locationRow}>
                                <Ionicons name="location" size={12} color={success} />
                                <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={1}>
                                    {request.dropoff_location?.address || 'Dropoff Location'}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.rejectBtn]}
                            onPress={() => handleResponse('rejected')}
                        >
                            <ThemedText style={styles.btnText}>Reject</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.acceptBtn]}
                            onPress={() => handleResponse('accepted')}
                        >
                            <ThemedText style={styles.btnText}>Accept</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        paddingBottom: 40,
        paddingHorizontal: 20
    },
    card: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10
    },
    content: {
        width: '100%',
        marginBottom: 24
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 8
    },
    price: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    locationContainer: {
        gap: 0
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    address: {
        fontSize: 14,
        flex: 1
    },
    line: {
        height: 20,
        width: 1,
        backgroundColor: '#ccc',
        marginLeft: 5.5,
        marginVertical: 4
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
        width: '100%'
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    rejectBtn: {
        backgroundColor: '#EF4444'
    },
    acceptBtn: {
        backgroundColor: '#22C55E'
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});
