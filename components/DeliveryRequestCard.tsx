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
    pickup_latitude?: number;
    pickup_longitude?: number;
    dropoff_latitude?: number;
    dropoff_longitude?: number;
    item_description: string;
    offered_price: number;
    item_image_url?: string;
    custom_type?: string;
    status?: string;
    vehicle_types?: string[];
    delivery_notes?: string;
    pickup_code?: string;
    delivery_code?: string;
    request_type?: 'package' | 'ride';
    rider_id?: string | null;
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
    myBid?: {
        id: string;
        amount: number;
        status?: string;
        created_at?: string;
    };
    showActions?: boolean;
}

export default function DeliveryRequestCard({ request, onBid, onAccept, myBid, showActions = true }: DeliveryRequestCardProps) {
    const router = useRouter();
    const [bidAmount, setBidAmount] = useState((request.offered_price ?? 0).toString());
    const [isBidding, setIsBidding] = useState(false);

    const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'text');
    const cardBg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const primary = '#F27C22';
    const requestStatus = (request.status || '').toLowerCase();
    const bidStatus = (myBid?.status || '').toLowerCase();
    const hasPendingBid = !!myBid && (bidStatus === 'pending' || bidStatus === '');
    const hasRejectedBid = !!myBid && ['rejected', 'declined', 'expired'].includes(bidStatus);
    const canPreviewRoute =
        requestStatus === 'pending' &&
        Number.isFinite(Number(request.pickup_latitude)) &&
        Number.isFinite(Number(request.pickup_longitude)) &&
        Number.isFinite(Number(request.dropoff_latitude)) &&
        Number.isFinite(Number(request.dropoff_longitude));
    const statusLabel = (() => {
        if (requestStatus === 'accepted') return 'Active Job';
        if (requestStatus === 'picked_up' || requestStatus === 'with_rider') return 'Picked Up';
        if (requestStatus === 'out_for_delivery') return 'In Transit';
        if (requestStatus === 'delivered' || requestStatus === 'completed') return 'Delivered';
        if (requestStatus === 'cancelled' || requestStatus === 'rejected') return 'Cancelled';
        return 'New Request';
    })();
    const statusStyle = (() => {
        if (requestStatus === 'accepted' || requestStatus === 'picked_up' || requestStatus === 'with_rider' || requestStatus === 'out_for_delivery') {
            return { badge: { backgroundColor: '#e8f5e9' }, text: { color: '#4CAF50' } };
        }
        if (requestStatus === 'delivered' || requestStatus === 'completed') {
            return { badge: { backgroundColor: '#E8F8EC' }, text: { color: '#16A34A' } };
        }
        if (requestStatus === 'cancelled' || requestStatus === 'rejected') {
            return { badge: { backgroundColor: '#FEE2E2' }, text: { color: '#B91C1C' } };
        }
        return { badge: {}, text: {} };
    })();

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
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, statusStyle.badge]}>
                        <ThemedText style={[styles.badgeText, statusStyle.text]}>
                            {statusLabel}
                        </ThemedText>
                    </View>
                    {request.rider_id && requestStatus === 'pending' && (
                        <View style={[styles.badge, { backgroundColor: 'rgba(33, 150, 243, 0.12)' }]}>
                            <ThemedText style={[styles.badgeText, { color: '#2196F3' }]}>
                                Direct Request
                            </ThemedText>
                        </View>
                    )}
                    {request.request_type === 'ride' && (
                        <View style={[styles.badge, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                            <ThemedText style={[styles.badgeText, { color: '#4CAF50' }]}>
                                Passenger Ride
                            </ThemedText>
                        </View>
                    )}
                </View>
                <ThemedText style={styles.price}>NGN {(request.offered_price ?? 0).toLocaleString()}</ThemedText>
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

            {canPreviewRoute && (
                <View style={styles.previewHintRow}>
                    <Ionicons name="map-outline" size={14} color={primary} />
                    <ThemedText style={styles.previewHintText}>Tap card to preview map and distance</ThemedText>
                </View>
            )}

            {/* Additional Details (Vehicles & Notes) */}
            <View style={styles.detailsContainer}>
                {request.item_image_url && (
                    <Image source={{ uri: request.item_image_url }} style={styles.itemImage} resizeMode="cover" />
                )}

                <View style={styles.detailsRow}>
                    <Ionicons name={request.request_type === 'ride' ? 'person-outline' : 'cube-outline'} size={16} color={textColor} />
                    <ThemedText style={styles.detailText}>{request.request_type === 'ride' ? 'Ride Request' : request.item_description}</ThemedText>
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

            {hasPendingBid ? (
                <View style={[styles.statusBanner, { backgroundColor: '#FFF3E0' }]}>
                    <ThemedText style={styles.statusBannerTitle}>You Bid: NGN {(myBid?.amount || 0).toLocaleString()}</ThemedText>
                    <ThemedText style={styles.statusBannerText}>Waiting for customer response...</ThemedText>
                </View>
            ) : hasRejectedBid ? (
                <View style={[styles.statusBanner, { backgroundColor: '#FEE2E2' }]}>
                    <ThemedText style={[styles.statusBannerTitle, { color: '#B91C1C' }]}>Bid Declined</ThemedText>
                    <ThemedText style={[styles.statusBannerText, { color: '#7F1D1D' }]}>
                        Customer declined your previous bid. You can bid again.
                    </ThemedText>
                </View>
            ) : null}

            {showActions && requestStatus === 'pending' ? (
                request.rider_id ? (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.acceptBtn]}
                            onPress={() => onAccept(request.id, request.offered_price ?? 0)}
                        >
                            <ThemedText style={styles.btnText}>
                                Accept Request: NGN {(request.offered_price ?? 0).toLocaleString()}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : isBidding ? (
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
                        <TouchableOpacity style={[styles.button, styles.bidBtn, { borderColor: primary }]} onPress={() => {
                            setBidAmount((myBid?.amount || request.offered_price || 0).toString());
                            setIsBidding(true);
                        }}>
                            <ThemedText style={[styles.btnText, { color: primary }]}>{hasPendingBid ? 'Update Bid' : hasRejectedBid ? 'Bid Again' : 'Bid'}</ThemedText>
                        </TouchableOpacity>

                        {!hasPendingBid && (
                            <TouchableOpacity style={[styles.button, styles.acceptBtn]} onPress={() => onAccept(request.id, request.offered_price ?? 0)}>
                                <ThemedText style={styles.btnText}>Accept: NGN {(request.offered_price ?? 0).toLocaleString()}</ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                )
            ) : null}

            {requestStatus === 'accepted' && (
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
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
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
    previewHintRow: {
        marginTop: 8,
        marginLeft: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    previewHintText: {
        fontSize: 12,
        color: '#F27C22',
        fontWeight: '600',
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
    statusBanner: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        width: '100%',
    },
    statusBannerTitle: {
        color: '#F27C22',
        fontWeight: '700',
        marginBottom: 4,
    },
    statusBannerText: {
        fontSize: 12,
        lineHeight: 18,
        flexWrap: 'wrap',
        flexShrink: 1,
        opacity: 0.9,
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

