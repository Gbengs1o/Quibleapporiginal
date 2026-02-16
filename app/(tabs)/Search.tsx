import LogoLoader from '@/components/LogoLoader';
import { ThemedText } from '@/components/themed-text';
import TunnelAnimation from '@/components/TunnelAnimation';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
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
const FEATURED_RESTAURANTS = [
  { id: '1', name: 'The Spice Kitchen', cuisine: 'Nigerian • African', rating: 4.8, image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400', deliveryTime: '25-35 min' },
  { id: '2', name: 'Mama\'s Delight', cuisine: 'Local Cuisine', rating: 4.9, image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400', deliveryTime: '20-30 min' },
  { id: '3', name: 'Urban Grill House', cuisine: 'BBQ • Steaks', rating: 4.7, image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400', deliveryTime: '30-40 min' },
];

const QUICK_CATEGORIES = [
  { id: '1', name: 'Food', icon: 'restaurant', color: ORANGE },
  { id: '2', name: 'Riders', icon: 'bicycle', color: ORANGE },
  { id: '3', name: 'Grocery', icon: 'basket', color: ORANGE },
  { id: '4', name: 'Handyman', icon: 'hammer', color: ORANGE },
];

const POPULAR_DISHES = [
  { id: '1', name: 'Jollof Rice Special', restaurant: 'Mama\'s Kitchen', price: '₦2,500', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=300' },
  { id: '2', name: 'Suya Platter', restaurant: 'Northern Grill', price: '₦3,000', image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300' },
  { id: '3', name: 'Egusi Soup', restaurant: 'Village Pot', price: '₦1,800', image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=300' },
  { id: '4', name: 'Pounded Yam', restaurant: 'Authentic Naija', price: '₦2,200', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' },
];

type SearchResult = {
  type: 'restaurant' | 'dish' | 'rider';
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  meta?: string;
};

const SEARCH_HISTORY_KEY = 'quible_search_history';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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
    fetchFeedData();
    loadSearchHistory();
  }, []);

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
      // Fetch Real Restaurants
      const { data: restData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true)
        .limit(5);

      if (restData && restData.length > 0) {
        setRestaurants(restData);
      }

      // Fetch Real Menu Items
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*, restaurants(name)')
        .eq('is_active', true)
        .limit(6);

      if (menuData && menuData.length > 0) {
        setMenuItems(menuData);
      }
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

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (text.length > 0) {
      searchFocus.value = withTiming(1);
      performSearch(text);
    } else {
      searchFocus.value = withTiming(0);
      setResults([]);
    }
  };

  const performSearch = useCallback(
    debounce(async (query: string) => {
      // Verify query length to avoid empty searches
      if (!query || query.trim().length < 2) return;

      setLoading(true);
      try {
        const searchResults: SearchResult[] = [];

        // 1. Search Restaurants (Name or Cuisine)
        const { data: rests, error: restError } = await supabase
          .from('restaurants')
          .select('id, name, cuisine_type, image_url')
          .or(`name.ilike.%${query}%,cuisine_type.ilike.%${query}%`)
          .limit(5);

        if (!restError && rests) {
          searchResults.push(...rests.map((r: any) => ({
            type: 'restaurant' as const,
            id: r.id,
            title: r.name,
            subtitle: r.cuisine_type || 'Restaurant',
            image: r.image_url,
            meta: 'Place'
          })));
        }

        // 2. Search Dishes (Name)
        const { data: items, error: itemError } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, restaurants(name)')
          .ilike('name', `%${query}%`)
          .limit(10);

        if (!itemError && items) {
          searchResults.push(...items.map((m: any) => ({
            type: 'dish' as const,
            id: m.id,
            title: m.name,
            subtitle: m.restaurants?.name || 'Dish',
            image: m.image_url,
            meta: `₦${m.price}`
          })));
        }

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  const handleResultPress = (item: SearchResult) => {
    saveSearchTerm(searchText);
    if (item.type === 'restaurant') {
      router.push(`/restaurant-profile/${item.id}`);
    } else if (item.type === 'dish') {
      router.push(`/dish/${item.id}`);
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
    <View style={[styles.header, { paddingTop: insets.top + 100 }]}>
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
            placeholder="Search restaurants, dishes, riders..."
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
      <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Quick Access</ThemedText>
      <View style={styles.categoryRow}>
        {QUICK_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => handleSearchChange(cat.name === 'Food' ? 'Restaurant' : cat.name)}
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

  const renderFeaturedRestaurants = () => (
    <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Featured Places</ThemedText>
        <Animated.View style={[styles.featuredBadge, { backgroundColor: ORANGE }, pulseStyle]}>
          <Ionicons name="flame" size={12} color="#FFF" />
          <ThemedText style={styles.featuredBadgeText}>HOT</ThemedText>
        </Animated.View>
      </View>

      <FlatList
        data={restaurants.length > 0 ? restaurants : FEATURED_RESTAURANTS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 20 }}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
            <TouchableOpacity
              style={[styles.featuredCard, { borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/restaurant-profile/${item.id}`)}
            >
              <Image
                source={{ uri: item.image_url || item.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400' }}
                style={styles.featuredImage}
              />
              <LinearGradient
                colors={['transparent', 'rgba(31,32,80,0.95)']}
                style={styles.featuredGradient}
              />
              <View style={styles.featuredContent}>
                <ThemedText style={styles.featuredName}>{item.name}</ThemedText>
                <ThemedText style={styles.featuredCuisine}>{item.cuisine_type || item.cuisine || 'Restaurant'}</ThemedText>
                <View style={styles.featuredMeta}>
                  <View style={[styles.ratingBadge, { backgroundColor: ORANGE }]}>
                    <Ionicons name="star" size={12} color="#FFF" />
                    <ThemedText style={styles.ratingText}>{item.rating || '4.5'}</ThemedText>
                  </View>
                  <ThemedText style={styles.deliveryTime}>{item.deliveryTime || '25-35 min'}</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      />
    </Animated.View>
  );

  const renderPopularDishes = () => (
    <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Popular Right Now</ThemedText>
      <View style={styles.dishGrid}>
        {(menuItems.length > 0 ? menuItems : POPULAR_DISHES).slice(0, 4).map((dish, index) => (
          <Animated.View
            key={dish.id}
            entering={FadeInUp.delay(400 + index * 80).springify()}
            style={[styles.dishCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.8}
              onPress={() => router.push(`/dish/${dish.id}`)}
            >
              <Image
                source={{ uri: dish.image_url || dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' }}
                style={styles.dishImage}
              />
              <View style={styles.dishInfo}>
                <ThemedText style={[styles.dishName, { color: colors.text }]} numberOfLines={1}>{dish.name}</ThemedText>
                <ThemedText style={[styles.dishRestaurant, { color: colors.textSec }]} numberOfLines={1}>
                  {dish.restaurants?.name || dish.restaurant}
                </ThemedText>
                <View style={styles.dishPriceRow}>
                  <ThemedText style={[styles.dishPrice, { color: ORANGE }]}>
                    {dish.price ? `₦${dish.price}` : dish.price}
                  </ThemedText>
                  <TouchableOpacity style={[styles.addButton, { backgroundColor: ORANGE }]}>
                    <Ionicons name="add" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

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

  const renderSearchResults = () => (
    <Animated.View entering={FadeInDown.springify()} style={styles.resultsContainer}>
      {loading && (
        <View style={styles.loadingContainer}>
          <LogoLoader size={80} />
        </View>
      )}

      {!loading && results.length === 0 && searchText.length > 2 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color={ORANGE_MEDIUM} />
          <ThemedText style={[styles.emptyText, { color: colors.textSec }]}>
            No results for "{searchText}"
          </ThemedText>
        </View>
      )}

      {results.map((item, index) => (
        <Animated.View
          key={`${item.type}-${item.id}`}
          entering={FadeInUp.delay(index * 60).springify()}
        >
          <TouchableOpacity
            style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleResultPress(item)}
          >
            <View style={[styles.resultIcon, { backgroundColor: ORANGE_LIGHT }]}>
              <Ionicons
                name={item.type === 'restaurant' ? 'restaurant' : item.type === 'rider' ? 'bicycle' : 'fast-food'}
                size={20}
                color={ORANGE}
              />
            </View>
            <View style={styles.resultInfo}>
              <ThemedText style={[styles.resultTitle, { color: colors.text }]}>{item.title}</ThemedText>
              <ThemedText style={[styles.resultSub, { color: colors.textSec }]}>{item.subtitle}</ThemedText>
            </View>
            <View style={[styles.resultMeta, { backgroundColor: ORANGE_LIGHT }]}>
              <ThemedText style={[styles.resultMetaText, { color: ORANGE }]}>{item.meta}</ThemedText>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {renderHeader()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
      >
        {searchText.length > 0 ? (
          renderSearchResults()
        ) : (
          <>
            {renderQuickCategories()}
            {renderFeaturedRestaurants()}
            {renderPopularDishes()}
            {renderRecentSearches()}
          </>
        )}
      </ScrollView>
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
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
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
  dishGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  dishCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  dishImage: {
    width: '100%',
    height: 100,
  },
  dishInfo: {
    padding: 12,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '600',
  },
  dishRestaurant: {
    fontSize: 12,
    marginTop: 2,
  },
  dishPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dishPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  resultsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 14,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultSub: {
    fontSize: 13,
    marginTop: 2,
  },
  resultMeta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resultMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
