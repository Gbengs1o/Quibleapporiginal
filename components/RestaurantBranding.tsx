import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, ViewStyle } from 'react-native';

interface RestaurantBrandingProps {
  userId: string;
  style?: ViewStyle;
}

interface RestaurantProfile {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
}

export default function RestaurantBranding({ userId, style }: RestaurantBrandingProps) {
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    fetchRestaurantProfile();

    // Subscribe to changes
    const subscription = supabase
      .channel(`restaurant-branding-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          setRestaurant(payload.new as RestaurantProfile);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const fetchRestaurantProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('restaurants')
        .select('id, owner_id, name, logo_url')
        .eq('owner_id', userId)
        .single();

      if (queryError) {
        console.error('Error fetching restaurant profile:', queryError);
        setError('Unable to load restaurant information. Please try again.');
        return;
      }

      if (!data) {
        setError('Restaurant profile not found. Please contact support.');
        return;
      }

      setRestaurant(data);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#1f2050" />
      </View>
    );
  }

  if (error || !restaurant) {
    return (
      <View style={[styles.container, style]}>
        <ThemedText style={styles.errorText}>{error || 'Error loading restaurant'}</ThemedText>
      </View>
    );
  }

  const firstLetter = restaurant.name.charAt(0).toUpperCase();
  const showPlaceholder = !restaurant.logo_url || imageError;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.logoContainer}>
        {showPlaceholder ? (
          <View style={styles.placeholderLogo}>
            <ThemedText style={styles.placeholderText}>{firstLetter}</ThemedText>
          </View>
        ) : (
          <Image
            source={{ uri: restaurant.logo_url! }}
            style={styles.logo}
            onError={() => setImageError(true)}
          />
        )}
      </View>
      <ThemedText style={styles.restaurantName}>{restaurant.name}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 40,
    height: 40,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
  },
});
