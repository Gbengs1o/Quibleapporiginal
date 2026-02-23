import DeliveryCard from '@/components/DeliveryCard';
import NearbyDishes from '@/components/NearbyDishes';
import NearbyStores from '@/components/NearbyStores';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface HomeDiscoveryProps {
    searchQuery: string;
    dishCategoryFilter: string | null;
    storeCategoryFilter: string | null;
    sortBy: any;
    priceRange: any;
    ratingFilter: number;
}

const HomeDiscovery: React.FC<HomeDiscoveryProps> = (props) => {
    const router = useRouter();
    const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
    const secondaryText = useThemeColor({ light: '#666', dark: '#999' }, 'text');

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {/* 1. Hero / Delivery Service */}
            <DeliveryCard />


            {/* 2. Store Spotlight (The "Jacket" / "Store Food" cards the user mentioned) */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <ThemedText style={styles.sectionTitle}>Store Spotlight</ThemedText>
                        <ThemedText style={{ color: secondaryText, fontSize: 13 }}>Daily essentials & more</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => {/* Logic to switch tab to store */ }}>
                        <ThemedText style={styles.seeAll}>See All</ThemedText>
                    </TouchableOpacity>
                </View>
                <NearbyStores
                    {...props}
                    isShelf={true}
                />
            </View>

            {/* 4. Top Picks (Food) */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <ThemedText style={styles.sectionTitle}>Top Picks for You</ThemedText>
                        <ThemedText style={{ color: secondaryText, fontSize: 13 }}>Popular dishes nearby</ThemedText>
                    </View>
                    <TouchableOpacity>
                        <ThemedText style={styles.seeAll}>See All</ThemedText>
                    </TouchableOpacity>
                </View>
                <NearbyDishes
                    {...props}
                    isShelf={true}
                />
            </View>

            <View style={{ height: 120 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 10,
    },
    section: {
        marginTop: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    seeAll: {
        color: '#f27c22',
        fontWeight: '700',
        fontSize: 14,
    },
    serviceGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 25,
    },
    serviceItem: {
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceLabel: {
        fontSize: 13,
        fontWeight: '600',
    }
});

export default HomeDiscovery;
