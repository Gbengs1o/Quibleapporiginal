import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
    DEFAULT_REFERRAL_SETTINGS,
    mergeReferralSettings,
    ReferralSystemSettings,
} from '@/utils/referral';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

export default function HomeReferralBanner() {
    const router = useRouter();
    const { user } = useAuth();
    const [settings, setSettings] = useState<ReferralSystemSettings>(DEFAULT_REFERRAL_SETTINGS);
    const [isVisible, setIsVisible] = useState(false);

    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const titleColor = useThemeColor({ light: '#1F2050', dark: '#F4F4F8' }, 'text');
    const subtitleColor = useThemeColor({ light: '#5B5E7A', dark: '#B6B8CC' }, 'text');
    const borderColor = useThemeColor({ light: '#F3D8BF', dark: '#3D3D5C' }, 'background');

    useEffect(() => {
        let isMounted = true;

        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('platform_settings')
                    .select('value')
                    .eq('key', 'referral_system')
                    .single();

                if (error) throw error;

                const merged = mergeReferralSettings(data?.value);
                if (!isMounted) return;

                setSettings(merged);
                setIsVisible(Boolean(merged.enabled && merged.is_banner_visible));
            } catch (error) {
                console.error('Error loading referral banner settings:', error);
                if (!isMounted) return;
                setSettings(DEFAULT_REFERRAL_SETTINGS);
                setIsVisible(Boolean(
                    DEFAULT_REFERRAL_SETTINGS.enabled && DEFAULT_REFERRAL_SETTINGS.is_banner_visible
                ));
            }
        };

        void fetchSettings();
        return () => {
            isMounted = false;
        };
    }, []);

    if (!isVisible) return null;

    const rewardText = settings.reward_type === 'percentage'
        ? `${settings.reward_value}%`
        : `N${settings.reward_value}`;

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.iconWrap}>
                <Ionicons name="gift" size={22} color="#F27C22" />
            </View>
            <View style={styles.content}>
                <ThemedText style={[styles.title, { color: titleColor }]} numberOfLines={1}>
                    {settings.banner_title}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={2}>
                    {settings.banner_subtitle}
                </ThemedText>
                <ThemedText style={styles.reward}>Reward: {rewardText}</ThemedText>
            </View>

            <TouchableOpacity
                style={styles.cta}
                activeOpacity={0.85}
                onPress={() => router.push(user ? '/invite-a-friend' : '/signup')}
            >
                <ThemedText style={styles.ctaText} numberOfLines={1}>
                    {settings.banner_cta_text}
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(242,124,34,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    content: {
        flex: 1,
        paddingRight: 10,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 11,
        lineHeight: 16,
    },
    reward: {
        marginTop: 5,
        fontSize: 11,
        fontWeight: '700',
        color: '#F27C22',
    },
    cta: {
        backgroundColor: '#1F2050',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        maxWidth: 120,
    },
    ctaText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
});
