import HomeCategories, { PriceRange, RatingFilter, ServiceCategory, SortOption } from '@/components/HomeCategories';
import HomeDiscovery from '@/components/HomeDiscovery';
import HomeHeader from '@/components/HomeHeader';
import HomeReferralBanner from '@/components/HomeReferralBanner';
import LogoLoader from '@/components/LogoLoader';
import NearbyDishes from '@/components/NearbyDishes';
import NearbyRiders from '@/components/NearbyRiders';
import NearbyStores from '@/components/NearbyStores';
import PromoCarousel from '@/components/PromoCarousel';
import ReferralWelcomePopup from '@/components/ReferralWelcomePopup';
import SidePanel from '@/components/SidePanel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useCart } from '@/contexts/cart';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const HomeScreen = () => {
  const [isSidePanelOpen, setSidePanelOpen] = useState(false);
  const { user, isReady } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Food-specific filters
  const [dishCategoryFilter, setDishCategoryFilter] = useState<string | null>(null);
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(0);

  const { getItemCount } = useCart();
  const router = useRouter();
  const textColor = useThemeColor({ light: '#1f2050', dark: '#fff' }, 'text');
  const secondaryText = useThemeColor({ light: '#666', dark: '#888' }, 'text');
  const cartBadgeBg = useThemeColor({ light: '#ef4444', dark: '#ef4444' }, 'background');

  useEffect(() => {
    if (isReady && !user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          setProfile(data);
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    if (isReady) {
      fetchProfile();
    }
  }, [user, isReady]);

  // Show loading state like Profile tab
  if (loading || !isReady) {
    return (
      <ThemedView style={styles.centered}>
        <LogoLoader size={80} />
      </ThemedView>
    );
  }

  const toggleSidePanel = () => {
    setSidePanelOpen(!isSidePanelOpen);
  };

  const cartItemCount = getItemCount();

  // Helper booleans
  const showFood = selectedCategory === 'food';
  const showDelivery = selectedCategory === 'delivery';
  const showHandy = selectedCategory === 'handy';
  const showStore = selectedCategory === 'store';
  const showDiscovery = selectedCategory === 'all';

  // --- 1. Static Header Content ---
  const renderCategoriesHeader = () => (
    <>
      <PromoCarousel />
      <HomeReferralBanner />
      <HomeCategories
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dishCategoryFilter={dishCategoryFilter}
        onDishCategoryChange={setDishCategoryFilter}
        storeCategoryFilter={storeCategoryFilter}
        onStoreCategoryChange={setStoreCategoryFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        ratingFilter={ratingFilter}
        onRatingFilterChange={setRatingFilter}
      />
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <HomeHeader onMenuPress={toggleSidePanel} profile={profile} />

      {/* --- Main Content Section --- */}
      {showDiscovery ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderCategoriesHeader()}
          <HomeDiscovery
            searchQuery={searchQuery}
            dishCategoryFilter={dishCategoryFilter}
            storeCategoryFilter={storeCategoryFilter}
            sortBy={sortBy}
            priceRange={priceRange}
            ratingFilter={ratingFilter}
          />
        </ScrollView>
      ) : showFood ? (
        <NearbyDishes
          searchQuery={searchQuery}
          categoryFilter={dishCategoryFilter}
          sortBy={sortBy}
          priceRange={priceRange}
          ratingFilter={ratingFilter}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={<>{renderCategoriesHeader()}</>}
          isShelf={false}
        />
      ) : showDelivery ? (
        <NearbyRiders
          searchQuery={searchQuery}
          ListHeaderComponent={<>{renderCategoriesHeader()}</>}
        />
      ) : showStore ? (
        <NearbyStores
          searchQuery={searchQuery}
          categoryFilter={storeCategoryFilter}
          sortBy={sortBy}
          priceRange={priceRange}
          ratingFilter={ratingFilter}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={<>{renderCategoriesHeader()}</>}
          isShelf={false}
        />
      ) : showHandy ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderCategoriesHeader()}
          <View style={styles.comingSoon}>
            <Ionicons name="construct" size={50} color={secondaryText} />
            <ThemedText style={[styles.comingSoonTitle, { color: secondaryText }]}>
              Handyman Services
            </ThemedText>
            <ThemedText style={[styles.comingSoonText, { color: secondaryText }]}>
              Find skilled professionals near you
            </ThemedText>
            <ThemedText style={styles.comingSoonBadge}>Coming Soon</ThemedText>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Fallback */}
        </ScrollView>
      )}

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <TouchableOpacity
          style={styles.floatingCartButton}
          onPress={() => router.push('/orders')}
          activeOpacity={0.9}
        >
          <Ionicons name="cart" size={24} color="#fff" />
          <ThemedText style={styles.cartButtonText}>View Cart</ThemedText>
          <View style={[styles.cartBadge, { backgroundColor: cartBadgeBg }]}>
            <ThemedText style={styles.cartBadgeText}>{cartItemCount}</ThemedText>
          </View>
        </TouchableOpacity>
      )}

      <ReferralWelcomePopup />
      <SidePanel isOpen={isSidePanelOpen} onClose={toggleSidePanel} profile={profile} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  comingSoonContainer: {
    flex: 1,
  },
  comingSoon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  comingSoonBadge: {
    marginTop: 20,
    backgroundColor: 'rgba(242, 124, 34, 0.15)',
    color: '#f27c22',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: '#f27c22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#f27c22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  cartBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
