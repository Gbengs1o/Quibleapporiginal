import { ThemedText } from '@/components/themed-text';
import TunnelAnimation from '@/components/TunnelAnimation';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

// ============ QUIBLE THEME ============
const ORANGE = '#F27C22';
const ORANGE_LIGHT = 'rgba(242, 124, 34, 0.1)';
const ORANGE_MEDIUM = 'rgba(242, 124, 34, 0.2)';
const NAVY = '#1F2050';
const NAVY_LIGHT = 'rgba(31, 32, 80, 0.08)';

// ============ MOCK DATA (Fallbacks) ============
const QUICK_CATEGORIES = [
  { id: '1', name: 'Food', icon: 'restaurant', color: ORANGE },
  { id: '2', name: 'Stores', icon: 'basket', color: ORANGE },
  { id: '3', name: 'Riders', icon: 'bicycle', color: ORANGE },
];

const RIDER_SERVICE_KEYWORDS = [
  'ride',
  'rider',
  'delivery',
  'logistics',
  'dispatch',
  'package',
  'bike',
  'bicycle',
  'motorcycle',
  'car',
  'keke',
  'tricycle',
  'van',
  'truck',
  'hailing',
  'service',
  'services',
  'uber',
];

const pickJoinedRow = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const debounce = <T extends (...args: any[]) => void>(fn: T, delayMs: number) => {
  let timeoutRef: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutRef) clearTimeout(timeoutRef);
    timeoutRef = setTimeout(() => fn(...args), delayMs);
  };

  debouncedFn.cancel = () => {
    if (timeoutRef) clearTimeout(timeoutRef);
    timeoutRef = null;
  };

  return debouncedFn as T & { cancel: () => void };
};

type SearchResult = {
  type: 'restaurant' | 'dish' | 'rider' | 'store' | 'store_item';
  id: string;
  title: string;
  subtitle: string;
  image: string;
  meta: string;
  distance?: number;
  price?: number;
};

type SearchTab = 'all' | 'food' | 'store' | 'rider';

const TAB_RESULT_TYPES: Record<SearchTab, SearchResult['type'][]> = {
  all: ['restaurant', 'dish', 'store', 'store_item', 'rider'],
  food: ['restaurant', 'dish'],
  store: ['store', 'store_item'],
  rider: ['rider'],
};

const RESULT_RAILS: Array<{ key: SearchResult['type']; title: string }> = [
  { key: 'restaurant', title: 'Restaurants' },
  { key: 'dish', title: 'Food Picks' },
  { key: 'store', title: 'Stores' },
  { key: 'store_item', title: 'Store Finds' },
  { key: 'rider', title: 'Riders Near You' },
];

const STORE_CATEGORIES = ['Grocery', 'Pharmacy', 'Fashion', 'Electronics', 'Beauty', 'Home', 'Supermarket'];

const SEARCH_HISTORY_KEY = 'quible_search_history';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchText, setSearchText] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Location & Filters
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sortBy, setSortBy] = useState('distance');
  const [priceRange, setPriceRange] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [storeCategory, setStoreCategory] = useState<string | null>(null);
  const [foodCategory, setFoodCategory] = useState<string | null>(null);

  // Animations
  const searchFocus = useSharedValue(0);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    initLocation();
    fetchFeedData();
    loadSearchHistory();
  }, []);

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getLastKnownPositionAsync({});
        if (loc) {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      }
    } catch (e) {
      console.log('Location error in Search', e);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat2 || !lon2) return 999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setRecentSearches(JSON.parse(history));
      }
    } catch (e) {
      console.log('Error loading history', e);
    }
  };

  const saveSearchTerm = async (term: string) => {
    if (!term.trim()) return;
    try {
      const newHistory = [term, ...recentSearches.filter(t => t !== term)].slice(0, 10);
      setRecentSearches(newHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.log('Error saving history', e);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      setRecentSearches([]);
    } catch (e) {
      console.log('Error clearing history', e);
    }
  };

  const fetchFeedData = async () => {
    try {
      // 1. Fetch Featured Places (Restaurants & Stores)
      const { data: restData } = await supabase
        .from('restaurants')
        .select('id, name, cuisine_type, restaurant_picture_url, status, current_rating')
        .eq('status', 'active')
        .limit(5);

      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, category, logo_url, status, current_rating')
        .eq('status', 'active')
        .limit(5);

      const combinedFeatured = [
        ...(restData || []).map(r => ({ ...r, type: 'restaurant', image: r.restaurant_picture_url })),
        ...(storeData || []).map(s => ({ ...s, type: 'store', image: s.logo_url, cuisine_type: s.category || 'Store' }))
      ].sort(() => Math.random() - 0.5);

      setRestaurants(combinedFeatured);

      // 2. Fetch Popular Items (Menu Items & Store Items)
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url, restaurants(name)')
        .eq('is_active', true)
        .limit(6);

      const { data: storeItemsData } = await supabase
        .from('store_items')
        .select('id, name, price, image_url, stores(name)')
        .eq('is_active', true)
        .limit(6);

      const combinedItems = [
        ...(menuData || []).map((m: any) => {
          const restaurant = pickJoinedRow<{ name?: string }>(m.restaurants);
          return { ...m, type: 'dish', restaurant: restaurant?.name, image_url: m.image_url };
        }),
        ...(storeItemsData || []).map((s: any) => {
          const store = pickJoinedRow<{ name?: string }>(s.stores);
          return { ...s, type: 'store_item', restaurant: store?.name, image_url: s.image_url };
        })
      ].sort(() => Math.random() - 0.5);

      setMenuItems(combinedItems);
    } catch (e) {
      console.error('Feed fetch error:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedData();
    setRefreshing(false);
  };

  const colors = {
    bg: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : NAVY,
    textSec: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(31,32,80,0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(31,32,80,0.1)',
    accent: ORANGE,
  };

  const displayResults = useMemo(() => {
    const allowedTypes = TAB_RESULT_TYPES[activeTab];
    return allResults.filter((item) => allowedTypes.includes(item.type));
  }, [activeTab, allResults]);

  const fallbackResults = useMemo(() => {
    if (activeTab === 'all' || displayResults.length > 0) return [];
    return allResults.slice(0, 12);
  }, [activeTab, allResults, displayResults.length]);

  const handleSearchChange = (text: string) => {
    if (searchText.length === 0 && text.length > 0) {
      setActiveTab('all');
    }

    setSearchText(text);
    if (text.length > 0) {
      searchFocus.value = withTiming(1);
      performSearch(text, sortBy, priceRange, ratingFilter, 'all', storeCategory, foodCategory);
    } else {
      searchFocus.value = withTiming(0);
      setAllResults([]);
    }
  };

  // Re-run search when filters change
  useEffect(() => {
    if (searchText.length > 1) {
      performSearch(searchText, sortBy, priceRange, ratingFilter, 'all', storeCategory, foodCategory);
    }
  }, [sortBy, priceRange, ratingFilter, searchText, storeCategory, foodCategory]);

  const performSearch = useCallback(
    debounce(async (query: string, sBy: string, pRange: string, _rFilter: number, aTab: string, sCat: string | null, fCat: string | null) => {
      if (!query || query.trim().length < 2) {
        setAllResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const searchResults: SearchResult[] = [];
        const normalizedQuery = query.trim().toLowerCase();
        const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
        const isServiceSearch = queryTokens.some((token) =>
          RIDER_SERVICE_KEYWORDS.some((keyword) => keyword.includes(token) || token.includes(keyword))
        );

        // 1. Search Restaurants
        if (aTab === 'all' || aTab === 'food') {
          let restQuery = supabase
            .from('restaurants')
            .select('id, name, cuisine_type, restaurant_picture_url, latitude, longitude, status')
            .or(`name.ilike.%${query}%,cuisine_type.ilike.%${query}%`)
            .eq('status', 'active');

          const { data: rests } = await restQuery.limit(10);

          if (rests) {
            searchResults.push(...rests.map((r: any) => ({
              type: 'restaurant' as const,
              id: r.id,
              title: r.name,
              subtitle: r.cuisine_type || 'Restaurant',
              image: r.restaurant_picture_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400', // Default image
              meta: userLocation ? `${calculateDistance(userLocation.latitude, userLocation.longitude, r.latitude, r.longitude).toFixed(1)}km` : 'Place',
              distance: userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, r.latitude, r.longitude) : 999,
              price: 0
            })));
          }
        }

        // 2. Search Dishes
        if (aTab === 'all' || aTab === 'food') {
          let dishQuery = supabase
            .from('menu_items')
            .select('id, name, price, image_url, restaurants(name, latitude, longitude)')
            .ilike('name', `%${query}%`)
            .eq('is_active', true);

          if (fCat) {
            dishQuery = dishQuery.ilike('category', `%${fCat}%`);
          }

          if (pRange === 'budget') dishQuery = dishQuery.lte('price', 2000);
          else if (pRange === 'mid') dishQuery = dishQuery.gt('price', 2000).lte('price', 5000);
          else if (pRange === 'premium') dishQuery = dishQuery.gt('price', 5000);

          const { data: items } = await dishQuery.limit(15);

          if (items) {
            searchResults.push(...items.map((m: any) => ({
              type: 'dish' as const,
              id: m.id,
              title: m.name,
              subtitle: pickJoinedRow<{ name?: string }>(m.restaurants)?.name || 'Dish',
              image: m.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300', // Default image
              meta: `NGN ${Number(m.price || 0).toLocaleString()}`,
              distance: userLocation && pickJoinedRow<{ latitude?: number; longitude?: number }>(m.restaurants)
                ? calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  pickJoinedRow<{ latitude?: number }>(m.restaurants)?.latitude || 0,
                  pickJoinedRow<{ longitude?: number }>(m.restaurants)?.longitude || 0
                )
                : 999,
              price: m.price
            })));
          }
        }

        // 3. Search Stores
        if (aTab === 'all' || aTab === 'store') {
          const { data: storesData } = await supabase
            .from('stores')
            .select('id, name, logo_url, address, latitude, longitude, status')
            .ilike('name', `%${query}%`)
            .eq('status', 'active')
            .limit(10);

          if (storesData) {
            searchResults.push(...storesData.map((s: any) => ({
              type: 'store' as const,
              id: s.id,
              title: s.name,
              subtitle: s.address || 'Store',
              image: s.logo_url || 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300', // Default image
              meta: 'Shop',
              distance: userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude) : 999,
              price: 0
            })));
          }
        }

        // 4. Search Store Items
        if (aTab === 'all' || aTab === 'store') {
          let storeItemQuery = supabase
            .from('store_items')
            .select('id, name, price, image_url, stores(name, latitude, longitude)')
            .ilike('name', `%${query}%`)
            .eq('is_active', true);

          if (sCat) {
            storeItemQuery = storeItemQuery.ilike('category', `%${sCat}%`);
          }

          if (pRange === 'budget') storeItemQuery = storeItemQuery.lte('price', 2000);
          else if (pRange === 'mid') storeItemQuery = storeItemQuery.gt('price', 2000).lte('price', 5000);
          else if (pRange === 'premium') storeItemQuery = storeItemQuery.gt('price', 5000);

          const { data: storeProducts } = await storeItemQuery.limit(15);

          if (storeProducts) {
            searchResults.push(...storeProducts.map((p: any) => ({
              type: 'store_item' as const,
              id: p.id,
              title: p.name,
              subtitle: pickJoinedRow<{ name?: string }>(p.stores)?.name || 'Product',
              image: p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300', // Default image
              meta: `NGN ${Number(p.price || 0).toLocaleString()}`,
              distance: userLocation && pickJoinedRow<{ latitude?: number; longitude?: number }>(p.stores)
                ? calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  pickJoinedRow<{ latitude?: number }>(p.stores)?.latitude || 0,
                  pickJoinedRow<{ longitude?: number }>(p.stores)?.longitude || 0
                )
                : 999,
              price: p.price
            })));
          }
        }

        // 5. Search Riders / Services
        if (aTab === 'all' || aTab === 'rider') {
          const { data: ridersData } = await supabase
            .from('riders')
            .select(`
              id,
              user_id,
              vehicle_type,
              average_rating,
              is_online,
              status,
              current_latitude,
              current_longitude,
              profile:profiles(first_name, last_name, profile_picture_url)
            `)
            .eq('status', 'active')
            .eq('is_online', true)
            .limit(40);

          if (ridersData) {
            const filteredRiders = ridersData
              .filter((r: any) => {
                const firstName = (r.profile?.first_name || '').toLowerCase();
                const lastName = (r.profile?.last_name || '').toLowerCase();
                const vehicleType = (r.vehicle_type || '').toLowerCase();
                const haystack = `${firstName} ${lastName} ${vehicleType}`;
                const textMatch = queryTokens.every((token) => haystack.includes(token));
                return textMatch || isServiceSearch;
              })
              .slice(0, 15);

            searchResults.push(...filteredRiders.map((r: any) => {
              const fullName = `${r.profile?.first_name || ''} ${r.profile?.last_name || ''}`.trim();
              const vehicle = (r.vehicle_type || 'rider').toString();
              const vehicleLabel = `${vehicle.charAt(0).toUpperCase()}${vehicle.slice(1)}`;
              const riderDistance = userLocation
                ? calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  r.current_latitude || 0,
                  r.current_longitude || 0
                )
                : 999;

              return {
                type: 'rider' as const,
                id: r.user_id || r.id,
                title: fullName || `${vehicleLabel} Rider`,
                subtitle: `${vehicleLabel} service`,
                image: r.profile?.profile_picture_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
                meta: userLocation
                  ? `${riderDistance.toFixed(1)}km`
                  : (r.average_rating ? `Rating ${Number(r.average_rating).toFixed(1)}` : 'Rider'),
                distance: riderDistance,
                price: 0
              };
            }));
          }
        }

        // 6. Final Sorting
        searchResults.sort((a: any, b: any) => {
          if (sBy === 'price_low') return (a.price || 0) - (b.price || 0);
          if (sBy === 'price_high') return (b.price || 0) - (a.price || 0);
          return (a.distance || 0) - (b.distance || 0);
        });

        setAllResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 500),
    [userLocation]
  );

  const handleResultPress = (item: SearchResult) => {
    saveSearchTerm(searchText);
    if (item.type === 'restaurant') {
      router.push(`/restaurant-profile/${item.id}`);
    } else if (item.type === 'dish') {
      router.push(`/dish/${item.id}`);
    } else if (item.type === 'store') {
      router.push(`/store-profile/${item.id}`);
    } else if (item.type === 'store_item') {
      router.push(`/store-item/${item.id}`);
    } else if (item.type === 'rider') {
      router.push(`/rider-profile/${item.id}`);
    }
  };

  const searchBarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(searchFocus.value, [0, 1], [1, 1.02]) }],
    borderColor: interpolate(searchFocus.value, [0, 1], [0, 1]) > 0.5 ? ORANGE : colors.border,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // ============ RENDER SECTIONS ============

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
      {/* Tunnel Animation Background */}
      <View style={styles.animationContainer}>
        <TunnelAnimation theme={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['transparent', '#0A0A0F'] : ['transparent', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.headerContent}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Discover</ThemedText>
        <ThemedText style={[styles.headerSub, { color: colors.textSec }]}>Find your next favorite</ThemedText>

        <Animated.View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFF', borderColor: colors.border }, searchBarStyle]}>
          <Ionicons name="search" size={20} color={ORANGE} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search restaurants, stores, items, riders, services..."
            placeholderTextColor={colors.textSec}
            value={searchText}
            onChangeText={handleSearchChange}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSec} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </View>
  );

  const renderQuickCategories = () => (
    <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
      <ThemedText style={[styles.sectionTitle, styles.sectionTitleStandalone, { color: colors.text }]}>Quick Access</ThemedText>
      <View style={styles.categoryRow}>
        {QUICK_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              const query = cat.name === 'Food' ? 'Restaurant' : cat.name;
              const tab: SearchTab = cat.name === 'Food' ? 'food' : (cat.name === 'Stores' ? 'store' : 'rider');
              setActiveTab(tab);
              setSearchText(query);
              searchFocus.value = withTiming(1);
              performSearch(query, sortBy, priceRange, ratingFilter, 'all', storeCategory, foodCategory);
            }}
          >
            <View style={[styles.categoryIcon, { backgroundColor: ORANGE_LIGHT }]}>
              <Ionicons name={cat.icon as any} size={22} color={ORANGE} />
            </View>
            <ThemedText style={[styles.categoryName, { color: colors.text }]}>{cat.name}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderFeaturedPlaces = () => (
    <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Featured Places</ThemedText>
        <Animated.View style={[styles.featuredBadge, { backgroundColor: ORANGE }, pulseStyle]}>
          <Ionicons name="flame" size={12} color="#FFF" />
          <ThemedText style={styles.featuredBadgeText}>HOT</ThemedText>
        </Animated.View>
      </View>

      <FlatList
        data={restaurants}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 20 }}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
            <TouchableOpacity
              style={[styles.featuredCard, { borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => item.type === 'restaurant' ? router.push(`/restaurant-profile/${item.id}`) : router.push(`/store-profile/${item.id}`)}
            >
              <Image
                source={{ uri: item.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' }}
                style={styles.featuredImage}
              />
              <LinearGradient
                colors={['transparent', 'rgba(31,32,80,0.95)']}
                style={styles.featuredGradient}
              />
              <View style={styles.featuredContent}>
                <ThemedText style={styles.featuredName}>{item.name}</ThemedText>
                <ThemedText style={styles.featuredCuisine}>{item.cuisine_type || 'Discovery'}</ThemedText>
                <View style={styles.featuredMeta}>
                  <View style={[styles.ratingBadge, { backgroundColor: ORANGE }]}>
                    <Ionicons name="star" size={12} color="#FFF" />
                    <ThemedText style={styles.ratingText}>{item.current_rating || '4.5'}</ThemedText>
                  </View>
                  <ThemedText style={styles.deliveryTime}>Featured</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      />
    </Animated.View>
  );

  const renderPopularDishes = () => {
    if (menuItems.length === 0) return null;

    return (
      <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Popular Right Now</ThemedText>
          <ThemedText style={[styles.railHintText, { color: colors.textSec }]}>Swipe to explore</ThemedText>
        </View>

        <FlatList
          data={menuItems}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(dish) => `${dish.type}-${dish.id}`}
          contentContainerStyle={styles.popularRailContent}
          renderItem={({ item: dish, index }) => (
            <Animated.View entering={FadeInRight.delay(360 + index * 80).springify()}>
              <TouchableOpacity
                style={[styles.popularCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.82}
                onPress={() => dish.type === 'dish' ? router.push(`/dish/${dish.id}`) : router.push(`/store-item/${dish.id}`)}
              >
                <Image
                  source={{ uri: dish.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' }}
                  style={styles.popularCardImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(10, 10, 15, 0.92)']}
                  style={styles.popularCardGradient}
                />
                <View style={styles.popularCardInfo}>
                  <ThemedText style={styles.popularCardTitle} numberOfLines={1}>{dish.name}</ThemedText>
                  <ThemedText style={styles.popularCardSub} numberOfLines={1}>{dish.restaurant}</ThemedText>
                  <View style={styles.popularCardBottom}>
                    <ThemedText style={styles.popularCardPrice}>NGN {Number(dish.price || 0).toLocaleString()}</ThemedText>
                    <View style={styles.popularCardCTA}>
                      <Ionicons name="arrow-forward" size={14} color="#FFF" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      </Animated.View>
    );
  };

  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;

    return (
      <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Recent Searches</ThemedText>
          <TouchableOpacity onPress={clearHistory}>
            <ThemedText style={{ color: colors.textSec, fontSize: 13, marginRight: 20 }}>Clear</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.recentRow}>
          {recentSearches.map((term, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.recentChip, { backgroundColor: ORANGE_LIGHT, borderColor: ORANGE_MEDIUM }]}
              onPress={() => handleSearchChange(term)}
            >
              <Ionicons name="time-outline" size={14} color={ORANGE} />
              <ThemedText style={[styles.recentText, { color: NAVY }]}>{term}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  const getResultIcon = (type: SearchResult['type']) => {
    if (type === 'restaurant') return 'restaurant';
    if (type === 'dish') return 'fast-food';
    if (type === 'store') return 'storefront';
    if (type === 'store_item') return 'basket';
    return 'bicycle';
  };

  const getResultLabel = (type: SearchResult['type']) => {
    if (type === 'restaurant') return 'Restaurant';
    if (type === 'dish') return 'Food';
    if (type === 'store') return 'Store';
    if (type === 'store_item') return 'Product';
    return 'Rider';
  };

  const renderSearchResultRails = () => {
    const sourceResults = displayResults.length > 0 ? displayResults : fallbackResults;

    if (sourceResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={60} color={colors.textSec} />
          <ThemedText style={[styles.emptyText, { color: colors.textSec }]}>No results found for "{searchText}"</ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.searchRailsWrap}>
        {displayResults.length === 0 && activeTab !== 'all' && allResults.length > 0 && (
          <View style={[styles.tabFallbackCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View>
              <ThemedText style={[styles.tabFallbackTitle, { color: colors.text }]}>No {activeTab} matches for "{searchText}"</ThemedText>
              <ThemedText style={[styles.tabFallbackSub, { color: colors.textSec }]}>Showing discovery from all categories</ThemedText>
            </View>
            <TouchableOpacity style={styles.tabFallbackAction} onPress={() => setActiveTab('all')}>
              <ThemedText style={styles.tabFallbackActionText}>View all</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {RESULT_RAILS.map((rail, railIndex) => {
          const railResults = sourceResults.filter((item) => item.type === rail.key);
          if (railResults.length === 0) return null;

          return (
            <Animated.View key={rail.key} entering={FadeInUp.delay(railIndex * 90).springify()} style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{rail.title}</ThemedText>
                <ThemedText style={[styles.railHintText, { color: colors.textSec }]}>{railResults.length} found</ThemedText>
              </View>
              <FlatList
                data={railResults}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                contentContainerStyle={styles.searchRailContent}
                renderItem={({ item, index }) => (
                  <Animated.View entering={FadeInRight.delay(index * 70).springify()}>
                    <TouchableOpacity
                      style={[styles.searchPosterCard, { borderColor: colors.border }]}
                      activeOpacity={0.86}
                      onPress={() => handleResultPress(item)}
                    >
                      <Image
                        source={{ uri: item.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' }}
                        style={styles.searchPosterImage}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(10, 10, 15, 0.96)']}
                        style={styles.searchPosterGradient}
                      />
                      <View style={styles.searchPosterContent}>
                        <View style={styles.searchPosterTypeRow}>
                          <View style={styles.searchPosterTypePill}>
                            <Ionicons name={getResultIcon(item.type)} size={12} color="#FFF" />
                            <ThemedText style={styles.searchPosterTypeText}>{getResultLabel(item.type)}</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.searchPosterTitle} numberOfLines={1}>{item.title}</ThemedText>
                        <ThemedText style={styles.searchPosterSubtitle} numberOfLines={1}>{item.subtitle}</ThemedText>
                        <View style={styles.searchPosterMetaPill}>
                          <ThemedText style={styles.searchPosterMetaText}>{item.meta}</ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              />
            </Animated.View>
          );
        })}
      </View>
    );
  };

  useEffect(() => {
    return () => {
      performSearch.cancel();
    };
  }, [performSearch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={[]}
        keyExtractor={(_, index) => `search-content-${index}`}
        renderItem={() => null}
        ListHeaderComponent={() => (
          <View>
            {renderHeader()}

            {searchText.length === 0 ? (
              <View style={styles.discoveryContent}>
                {renderQuickCategories()}
                {renderFeaturedPlaces()}
                {renderPopularDishes()}
                {renderRecentSearches()}
              </View>
            ) : (
              <View style={styles.searchContent}>
                <View style={styles.filterSection}>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[
                      { id: 'all', label: 'All', icon: 'apps' },
                      { id: 'food', label: 'Food', icon: 'restaurant' },
                      { id: 'store', label: 'Stores', icon: 'storefront' },
                      { id: 'rider', label: 'Riders', icon: 'bicycle' },
                    ]}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.filterScroll}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.filterTab, { borderColor: colors.border }, activeTab === item.id && styles.filterTabActive]}
                        onPress={() => setActiveTab(item.id as SearchTab)}
                      >
                        <ThemedText style={[styles.filterTabText, { color: activeTab === item.id ? '#fff' : colors.text }]}>
                          {item.label}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  />
                </View>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ThemedText style={{ color: colors.textSec }}>Searching...</ThemedText>
                  </View>
                ) : (
                  renderSearchResultRails()
                )}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.resultsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'relative',
    minHeight: 280,
  },
  animationContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 280,
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  headerSub: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  discoveryContent: {
    paddingBottom: 120,
  },
  searchContent: {
    paddingBottom: 120,
  },
  filterSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabActive: {
    backgroundColor: ORANGE,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionTitleStandalone: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  railHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredCard: {
    width: CARD_WIDTH,
    height: 200,
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  featuredCuisine: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  deliveryTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  popularRailContent: {
    paddingLeft: 20,
    paddingRight: 28,
  },
  popularCard: {
    width: width * 0.56,
    height: 210,
    borderRadius: 18,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  popularCardImage: {
    width: '100%',
    height: '100%',
  },
  popularCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  popularCardInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
  },
  popularCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  popularCardSub: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    marginTop: 3,
  },
  popularCardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularCardPrice: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  popularCardCTA: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  recentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchRailsWrap: {
    paddingBottom: 20,
  },
  tabFallbackCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tabFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabFallbackSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tabFallbackAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: ORANGE,
  },
  tabFallbackActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchRailContent: {
    paddingLeft: 20,
    paddingRight: 28,
  },
  searchPosterCard: {
    width: width * 0.62,
    height: 228,
    borderRadius: 18,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  searchPosterImage: {
    width: '100%',
    height: '100%',
  },
  searchPosterGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  searchPosterContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
  },
  searchPosterTypeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  searchPosterTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242,124,34,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  searchPosterTypeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  searchPosterTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  searchPosterSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    marginTop: 2,
  },
  searchPosterMetaPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  searchPosterMetaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  resultsContainer: {
    paddingTop: 0,
  },
  loadingContainer: {
    paddingVertical: 42,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
