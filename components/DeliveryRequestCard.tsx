import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Request {
    id: string;
    pickup_address: string;
    dropoff_address: string;
    item_description: string;
    offered_price: number;
    item_image_url?: string;
    custom_type?: string;
    status?: string;
    vehicle_types?: string[];
    delivery_notes?: string;
    pickup_code?: string;
}

const VEHICLE_ICONS: Record<string, any> = {
    bicycle: 'bicycle',
    bike: 'speedometer',
    car: 'car-sport',
    van: 'bus',
    keke: 'triangle'
};

interface DeliveryRequestCardProps {
    request: Request;
    onBid: (id: string, amount: number) => void;
    onAccept: (id: string, amount: number) => void;
    myBidAmount?: number;
    showActions?: boolean;
}

export default function DeliveryRequestCard({ request, onBid, onAccept, myBidAmount, showActions = true }: DeliveryRequestCardProps) {
    const router = useRouter();
    const [bidAmount, setBidAmount] = useState((request.offered_price ?? 0).toString());
    const [isBidding, setIsBidding] = useState(false);

    const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const primary = '#F27C22';

    const handleBidSubmit = () => {
        const amount = parseFloat(bidAmount);
        if (amount && amount > 0) {
            onBid(request.id, amount);
            setIsBidding(false);
        }
    };

    return (
        <ThemedView style={[styles.card, { borderColor, backgroundColor: cardBg }]}>
            <View style={styles.header}>
                <View style={[styles.badge, request.status === 'accepted' ? { backgroundColor: '#e8f5e9' } : {}]}>
                    <ThemedText style={[styles.badgeText, request.status === 'accepted' ? { color: '#4CAF50' } : {}]}>
                        {request.status === 'accepted' ? 'Active Job' : 'New Request'}
                    </ThemedText>
                </View>
                <ThemedText style={styles.price}>₦{(request.offered_price ?? 0).toLocaleString()}</ThemedText>
            </View>

            <View style={styles.routeContainer}>
                {/* Pickup */}
                <View style={styles.locationRow}>
                    <Ionicons name="ellipse" size={12} color={primary} />
                    <View style={styles.locationTextContainer}>
                        <ThemedText style={styles.label}>Pickup</ThemedText>
                        <ThemedText style={styles.address} numberOfLines={1}>{request.pickup_address}</ThemedText>
                    </View>
                </View>

                {/* Connector Line */}
                <View style={[styles.line, { borderColor }]} />

                {/* Dropoff */}
                <View style={styles.locationRow}>
                    <Ionicons name="location" size={12} color="#4CAF50" />
                    <View style={styles.locationTextContainer}>
                        <ThemedText style={styles.label}>Dropoff</ThemedText>
                        <ThemedText style={styles.address} numberOfLines={1}>{request.dropoff_address}</ThemedText>
                    </View>
                </View>
            </View>

            {/* Additional Details (Vehicles & Notes) */}
            <View style={styles.detailsContainer}>
                {request.item_image_url && (
                    <Image source={{ uri: request.item_image_url }} style={styles.itemImage} resizeMode="cover" />
                )}

                <View style={styles.detailsRow}>
                    <Ionicons name="cube-outline" size={16} color={textColor} />
                    <ThemedText style={styles.detailText}>{request.item_description}</ThemedText>
                </View>

                {request.delivery_notes && (
                    <View style={[styles.detailsRow, { marginTop: 8 }]}>
                        <Ionicons name="document-text-outline" size={16} color={textColor} />
                        <ThemedText style={[styles.detailText, { fontStyle: 'italic', color: '#666' }]}>
                            "{request.delivery_notes}"
                        </ThemedText>
                    </View>
                )}

                {request.vehicle_types && request.vehicle_types.length > 0 && (
                    <View style={[styles.detailsRow, { marginTop: 12 }]}>
                        <Ionicons name="car-outline" size={16} color={textColor} />
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {request.vehicle_types.map((v) => (
                                <View key={v} style={{ backgroundColor: '#F5F6FA', padding: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name={VEHICLE_ICONS[v] || 'car'} size={14} color="#555" />
                                    <ThemedText style={{ fontSize: 12, color: '#555', textTransform: 'capitalize' }}>{v}</ThemedText>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            {myBidAmount ? (
                <View style={[styles.footer, { backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, justifyContent: 'center' }]}>
                    <ThemedText style={{ color: '#F27C22', fontWeight: 'bold' }}>You Bid: ₦{myBidAmount.toLocaleString()}</ThemedText>
                    <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>Waiting for customer...</ThemedText>
                </View>
            ) : showActions && request.status === 'pending' ? (
                isBidding ? (
                    <View style={styles.bidContainer}>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor }]}
                            value={bidAmount}
                            onChangeText={setBidAmount}
                            keyboardType="numeric"
                            autoFocus
                        />
                        <View style={styles.bidActions}>
                            <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={() => setIsBidding(false)}>
                                <ThemedText style={{ color: textColor }}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.confirmBtn]} onPress={handleBidSubmit}>
                                <ThemedText style={styles.btnText}>Submit Bid</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.button, styles.bidBtn, { borderColor: primary }]} onPress={() => setIsBidding(true)}>
                            <ThemedText style={[styles.btnText, { color: primary }]}>Bid</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.acceptBtn]} onPress={() => onAccept(request.id, request.offered_price ?? 0)}>
                            <ThemedText style={styles.btnText}>Accept: ₦{(request.offered_price ?? 0).toLocaleString()}</ThemedText>
                        </TouchableOpacity>
                    </View>
                )
            ) : null}

            {request.pickup_code && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' }}>
                    <ThemedText style={{ textAlign: 'center', fontSize: 12, color: '#0369a1', marginBottom: 4 }}>
                        SECURE HANDOFF CODE
                    </ThemedText>
                    <ThemedText style={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#0284c7', letterSpacing: 4 }}>
                        {request.pickup_code}
                    </ThemedText>
                    <ThemedText style={{ textAlign: 'center', fontSize: 10, color: '#0369a1', marginTop: 4 }}>
                        Show this code to the restaurant
                    </ThemedText>
                </View>
            )}

            {request.status === 'accepted' && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.acceptBtn, { backgroundColor: '#4CAF50' }]}
                        onPress={() => router.push(`/rider/delivery/${request.id}`)}
                    >
                        <ThemedText style={styles.btnText}>Navigate to Pickup</ThemedText>
                    </TouchableOpacity>
                </View>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    badge: {
        backgroundColor: 'rgba(242, 124, 34, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        color: '#F27C22',
        fontSize: 12,
        fontWeight: '600',
    },
    price: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F27C22',
    },
    routeContainer: {
        marginLeft: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    locationTextContainer: {
        flex: 1,
    },
    line: {
        borderLeftWidth: 1,
        height: 20,
        marginLeft: 5.5,
        marginVertical: 2,
        borderStyle: 'dashed',
    },
    label: {
        fontSize: 10,
        opacity: 0.5,
        textTransform: 'uppercase',
    },
    address: {
        fontSize: 14,
        fontWeight: '500',
    },
    detailsContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    itemImage: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        marginBottom: 12,
        backgroundColor: '#f5f5f5',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        opacity: 0.8,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bidBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    acceptBtn: {
        backgroundColor: '#F27C22',
    },
    btnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    bidContainer: {
        marginTop: 16,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        fontSize: 16,
    },
    bidActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        backgroundColor: '#f0f0f0',
    },
    confirmBtn: {
        backgroundColor: '#F27C22',
    },
});
