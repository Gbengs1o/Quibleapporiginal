import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@/utils/AsyncStorage';
import {
    buildReferralShareMessage,
    DEFAULT_REFERRAL_SETTINGS,
    mergeReferralSettings,
    normalizeReferralCode,
    PENDING_REFERRAL_CODE_STORAGE_KEY,
    REFERRAL_POPUP_SEEN_STORAGE_KEY,
    ReferralSystemSettings,
} from '@/utils/referral';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText } from './themed-text';

export default function ReferralWelcomePopup() {
    const { user } = useAuth();
    const router = useRouter();

    const [visible, setVisible] = useState(false);
    const [settings, setSettings] = useState<ReferralSystemSettings>(DEFAULT_REFERRAL_SETTINGS);
    const [referralCode, setReferralCode] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [isApplyingCode, setIsApplyingCode] = useState(false);

    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const titleColor = useThemeColor({ light: '#1F2050', dark: '#F4F4F8' }, 'text');
    const subtitleColor = useThemeColor({ light: '#5F637A', dark: '#B7BAD0' }, 'text');
    const inputBg = useThemeColor({ light: '#F7F8FC', dark: '#252538' }, 'background');
    const inputBorder = useThemeColor({ light: '#D9DCEA', dark: '#3D3D5C' }, 'background');

    const markSeenIfNeeded = async (activeSettings: ReferralSystemSettings) => {
        if (!activeSettings.popup_show_once) return;
        await AsyncStorage.setItem(REFERRAL_POPUP_SEEN_STORAGE_KEY, '1');
    };

    useEffect(() => {
        let isMounted = true;

        const loadPopup = async () => {
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

                if (!merged.enabled || !merged.is_popup_visible) {
                    setVisible(false);
                    return;
                }

                if (merged.popup_show_once) {
                    const seen = await AsyncStorage.getItem(REFERRAL_POPUP_SEEN_STORAGE_KEY);
                    if (!isMounted) return;
                    if (seen === '1') {
                        setVisible(false);
                        return;
                    }
                }

                const pending = normalizeReferralCode(
                    await AsyncStorage.getItem(PENDING_REFERRAL_CODE_STORAGE_KEY)
                );
                if (!isMounted) return;
                setManualCode(pending);

                if (user?.id) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('referral_code')
                        .eq('id', user.id)
                        .single();

                    let code = normalizeReferralCode(profileData?.referral_code);
                    if (!code) {
                        const { data: ensured } = await supabase.rpc('ensure_my_referral_code');
                        if ((ensured as any)?.success) {
                            code = normalizeReferralCode((ensured as any).referral_code);
                        }
                    }

                    if (!isMounted) return;
                    setReferralCode(code);
                } else {
                    setReferralCode('');
                }

                setVisible(true);
            } catch (error) {
                console.error('Error loading referral popup:', error);
                if (isMounted) setVisible(false);
            }
        };

        void loadPopup();
        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const closePopup = async () => {
        await markSeenIfNeeded(settings);
        setVisible(false);
    };

    const handleShare = async () => {
        if (!user?.id || !referralCode) {
            await closePopup();
            router.push('/signup');
            return;
        }

        try {
            const message = buildReferralShareMessage(settings, referralCode);
            await Share.share({
                title: settings.popup_title,
                message,
            });
            await closePopup();
        } catch (error) {
            console.error('Error sharing referral from popup:', error);
        }
    };

    const handleApplyManualCode = async () => {
        const normalized = normalizeReferralCode(manualCode);
        if (!normalized) {
            Alert.alert('Referral', 'Enter a valid referral code.');
            return;
        }

        if (!user?.id) {
            await AsyncStorage.setItem(PENDING_REFERRAL_CODE_STORAGE_KEY, normalized);
            Alert.alert('Saved', 'Referral code saved. Continue signup to apply it.');
            await closePopup();
            router.push({ pathname: '/signup', params: { ref: normalized } } as any);
            return;
        }

        try {
            setIsApplyingCode(true);
            const { data, error } = await supabase.rpc('apply_referral_code', {
                p_referral_code: normalized,
            });

            if (error) throw error;

            const payload = (data || {}) as { success?: boolean; message?: string; referrer_name?: string };
            if (payload.success) {
                await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
                Alert.alert(
                    'Referral Applied',
                    payload.referrer_name
                        ? `Code applied successfully. Referred by ${payload.referrer_name}.`
                        : 'Code applied successfully.'
                );
                return;
            }

            Alert.alert('Referral', payload.message || 'Could not apply referral code.');
        } catch (error: any) {
            Alert.alert('Referral', error?.message || 'Could not apply referral code.');
        } finally {
            setIsApplyingCode(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => {
                void closePopup();
            }}
        >
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => void closePopup()}>
                        <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>

                    <ThemedText style={[styles.title, { color: titleColor }]}>
                        {settings.popup_title}
                    </ThemedText>
                    <ThemedText style={[styles.subtitle, { color: subtitleColor }]}>
                        {settings.popup_subtitle}
                    </ThemedText>

                    <View style={styles.highlight}>
                        <Ionicons name="sparkles-outline" size={16} color="#F27C22" />
                        <ThemedText style={styles.highlightText}>
                            {settings.popup_reward_highlight}
                        </ThemedText>
                    </View>

                    {referralCode ? (
                        <View style={styles.codeWrap}>
                            <ThemedText style={[styles.codeLabel, { color: subtitleColor }]}>
                                {settings.popup_code_label}
                            </ThemedText>
                            <ThemedText style={[styles.codeValue, { color: titleColor }]}>
                                {referralCode}
                            </ThemedText>
                        </View>
                    ) : null}

                    {settings.allow_manual_referral_entry ? (
                        <View style={styles.manualWrap}>
                            <TextInput
                                value={manualCode}
                                onChangeText={setManualCode}
                                placeholder="Enter referral code"
                                autoCapitalize="characters"
                                placeholderTextColor="#9CA3AF"
                                style={[
                                    styles.manualInput,
                                    { backgroundColor: inputBg, borderColor: inputBorder, color: titleColor },
                                ]}
                            />
                            <TouchableOpacity
                                style={[styles.manualBtn, isApplyingCode && styles.manualBtnDisabled]}
                                disabled={isApplyingCode}
                                onPress={() => void handleApplyManualCode()}
                            >
                                <ThemedText style={styles.manualBtnText}>
                                    {isApplyingCode ? 'Applying...' : 'Apply Code'}
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => void handleShare()}
                        activeOpacity={0.88}
                    >
                        <ThemedText style={styles.shareText}>
                            {settings.popup_share_button_text}
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
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 410,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    closeBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        zIndex: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 6,
        paddingRight: 28,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    highlight: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(242,124,34,0.14)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 14,
        gap: 6,
    },
    highlightText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#F27C22',
    },
    codeWrap: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    codeLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    codeValue: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 2,
    },
    manualWrap: {
        marginBottom: 12,
    },
    manualInput: {
        height: 44,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    manualBtn: {
        height: 40,
        borderRadius: 10,
        backgroundColor: '#1F2050',
        alignItems: 'center',
        justifyContent: 'center',
    },
    manualBtnDisabled: {
        opacity: 0.65,
    },
    manualBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    shareBtn: {
        height: 46,
        borderRadius: 12,
        backgroundColor: '#F27C22',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
});
