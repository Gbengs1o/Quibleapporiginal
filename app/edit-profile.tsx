import LoadingAnimation from '@/components/LoadingAnimation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Brand colors
const BRAND_NAVY = '#1F2050';
const BRAND_ORANGE = '#f27c22';

// Input Field Component - Defined OUTSIDE to prevent re-renders
interface InputFieldProps {
    icon: string;
    iconPack?: 'ionicons' | 'material' | 'feather';
    value: string;
    onChangeText?: (text: string) => void;
    placeholder: string;
    editable?: boolean;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    autoCapitalize?: 'none' | 'sentences' | 'words';
    colors: {
        inputBackground: string;
        disabledInput: string;
        inputBorder: string;
        text: string;
        textMuted: string;
        iconColor: string;
    };
}

const InputField = React.memo(({
    icon,
    iconPack = 'ionicons',
    value,
    onChangeText,
    placeholder,
    editable = true,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    colors,
}: InputFieldProps) => {
    const IconComponent =
        iconPack === 'material'
            ? MaterialCommunityIcons
            : iconPack === 'feather'
                ? Feather
                : Ionicons;

    return (
        <View
            style={[
                styles.inputContainer,
                {
                    backgroundColor: editable ? colors.inputBackground : colors.disabledInput,
                    borderColor: colors.inputBorder,
                },
            ]}
        >
            <View style={styles.inputIconContainer}>
                <IconComponent name={icon as any} size={20} color={colors.iconColor} />
            </View>
            <TextInput
                style={[
                    styles.input,
                    {
                        color: editable ? colors.text : colors.textMuted,
                    },
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                editable={editable}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
            />
            {!editable && (
                <View style={styles.lockIconContainer}>
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                </View>
            )}
        </View>
    );
});

const EditProfileScreen = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const isDark = theme === 'dark';

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [town, setTown] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureMimeType, setProfilePictureMimeType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Theme colors with brand navy (#1F2050)
    const colors = {
        background: isDark ? '#0a0a0f' : '#f5f7fa',
        cardBackground: isDark ? 'rgba(31, 32, 80, 0.4)' : 'rgba(255, 255, 255, 0.95)',
        cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(31, 32, 80, 0.1)',
        inputBackground: isDark ? 'rgba(40, 40, 55, 0.6)' : 'rgba(245, 247, 250, 0.8)',
        inputBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(31, 32, 80, 0.12)',
        inputFocusBorder: BRAND_ORANGE,
        text: isDark ? '#ffffff' : '#1a1a2e',
        textSecondary: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
        textMuted: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)',
        accent: BRAND_ORANGE,
        accentGradient: [BRAND_ORANGE, '#ff9642'] as const,
        navy: BRAND_NAVY,
        navyLight: isDark ? 'rgba(31, 32, 80, 0.6)' : 'rgba(31, 32, 80, 0.08)',
        headerGradient: isDark
            ? ['rgba(31, 32, 80, 0.4)', 'rgba(31, 32, 80, 0.15)', 'transparent'] as const
            : ['rgba(31, 32, 80, 0.08)', 'rgba(31, 32, 80, 0.02)', 'transparent'] as const,
        avatarBorder: isDark ? BRAND_ORANGE : BRAND_NAVY,
        iconColor: isDark ? 'rgba(255, 255, 255, 0.5)' : BRAND_NAVY + '99',
        disabledInput: isDark ? 'rgba(60, 60, 75, 0.4)' : 'rgba(230, 232, 235, 0.8)',
    };

    // Memoized colors object for InputField to prevent re-renders
    const inputColors = React.useMemo(() => ({
        inputBackground: colors.inputBackground,
        disabledInput: colors.disabledInput,
        inputBorder: colors.inputBorder,
        text: colors.text,
        textMuted: colors.textMuted,
        iconColor: colors.iconColor,
    }), [isDark]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const fetchProfile = useCallback(async () => {
        if (user) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, phone_number, address, state, town, profile_picture_url')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    setFirstName(data.first_name || '');
                    setLastName(data.last_name || '');
                    setPhoneNumber(data.phone_number || '');
                    setAddress(data.address || '');
                    setState(data.state || '');
                    setTown(data.town || '');
                    setProfilePictureUrl(data.profile_picture_url || null);
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to fetch profile. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    }, [user?.id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            setProfilePictureUrl(result.assets[0].uri);
            setProfilePictureMimeType(result.assets[0].mimeType || null);
        }
    };

    const handleUpdate = useCallback(async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to update your profile.');
            return;
        }

        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert('Validation Error', 'First and last name are required.');
            return;
        }

        setIsSaving(true);

        try {
            let publicUrl = profilePictureUrl;

            if (profilePictureUrl && !profilePictureUrl.startsWith('https')) {
                const arraybuffer = await fetch(profilePictureUrl).then((res) => res.arrayBuffer());

                const fileExt = profilePictureUrl.split('.').pop()?.toLowerCase() ?? 'jpeg';
                const path = `${user.id}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('profile-pictures')
                    .upload(path, arraybuffer, {
                        contentType: profilePictureMimeType ?? `image/${fileExt}`,
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
                publicUrl = data.publicUrl;
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    phone_number: phoneNumber,
                    address,
                    state,
                    town,
                    profile_picture_url: publicUrl,
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Success', 'Your profile has been updated successfully!', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [firstName, lastName, user, phoneNumber, address, state, town, profilePictureUrl, profilePictureMimeType, router]);

    if (loading) {
        return (
            <ThemedView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <LoadingAnimation />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Gradient with Navy */}
            <LinearGradient
                colors={colors.headerGradient}
                style={[styles.headerGradient, { paddingTop: insets.top }]}
            />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View
                        style={[
                            styles.content,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Header with Back Button */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={[styles.backButton, { backgroundColor: BRAND_NAVY }]}
                                onPress={() => router.replace('/(tabs)/Profile')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={22} color="#fff" />
                            </TouchableOpacity>
                            <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
                                Edit Profile
                            </ThemedText>
                            <View style={styles.headerSpacer} />
                        </View>

                        {/* Profile Picture Section */}
                        <View style={styles.avatarSection}>
                            <View style={[styles.avatarContainer, { borderColor: colors.avatarBorder }]}>
                                <Image
                                    source={{
                                        uri: profilePictureUrl ? profilePictureUrl : ('https://ui-avatars.com/api/?name=' + (firstName || 'User') + '+' + (lastName || '') + '&background=1F2050&color=fff&size=200'),
                                    }}
                                    style={styles.avatar}
                                />
                                <TouchableOpacity
                                    style={styles.cameraButton}
                                    onPress={pickImage}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={colors.accentGradient}
                                        style={styles.cameraButtonGradient}
                                    >
                                        <Ionicons name="camera" size={18} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
                                <Text style={[styles.changePhotoText, { color: colors.accent }]}>
                                    Change Photo
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form Card */}
                        <View
                            style={[
                                styles.formCard,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.cardBorder,
                                },
                            ]}
                        >
                            {/* Section: Account Info */}
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIcon, { backgroundColor: colors.navyLight }]}>
                                    <Ionicons name="person" size={16} color={BRAND_NAVY} />
                                </View>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    Account Information
                                </Text>
                            </View>

                            <InputField
                                icon="mail-outline"
                                value={user?.email || ''}
                                placeholder="Email Address"
                                editable={false}
                                keyboardType="email-address"
                                colors={inputColors}
                            />

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="person-outline"
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        placeholder="First Name"
                                        autoCapitalize="words"
                                        colors={inputColors}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="person-outline"
                                        value={lastName}
                                        onChangeText={setLastName}
                                        placeholder="Last Name"
                                        autoCapitalize="words"
                                        colors={inputColors}
                                    />
                                </View>
                            </View>

                            <InputField
                                icon="call-outline"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="Phone Number"
                                keyboardType="phone-pad"
                                colors={inputColors}
                            />

                            {/* Section Divider */}
                            <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />

                            {/* Section: Location */}
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIcon, { backgroundColor: `${BRAND_ORANGE}15` }]}>
                                    <Ionicons name="location" size={16} color={BRAND_ORANGE} />
                                </View>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    Location Details
                                </Text>
                            </View>

                            <InputField
                                icon="home-outline"
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Street Address"
                                colors={inputColors}
                            />

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="business-outline"
                                        value={town}
                                        onChangeText={setTown}
                                        placeholder="City / Town"
                                        autoCapitalize="words"
                                        colors={inputColors}
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <InputField
                                        icon="map-outline"
                                        value={state}
                                        onChangeText={setState}
                                        placeholder="State"
                                        autoCapitalize="words"
                                        colors={inputColors}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Save Button - Navy to Orange Gradient */}
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleUpdate}
                            disabled={isSaving}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={isSaving ? ['#999', '#888'] : [BRAND_NAVY, BRAND_ORANGE]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.saveButtonGradient}
                            >
                                {isSaving ? (
                                    <View style={styles.savingContainer}>
                                        <LoadingAnimation />
                                        <Text style={styles.saveButtonText}>Saving...</Text>
                                    </View>
                                ) : (
                                    <View style={styles.saveButtonContent}>
                                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                                        <Text style={styles.saveButtonText}>Save Changes</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Tip Card */}
                        <View
                            style={[
                                styles.tipCard,
                                {
                                    backgroundColor: isDark ? 'rgba(31, 32, 80, 0.25)' : 'rgba(31, 32, 80, 0.06)',
                                    borderColor: isDark ? 'rgba(31, 32, 80, 0.4)' : 'rgba(31, 32, 80, 0.15)',
                                },
                            ]}
                        >
                            <View style={[styles.tipIconContainer, { backgroundColor: `${BRAND_NAVY}20` }]}>
                                <Ionicons name="information-circle" size={20} color={BRAND_NAVY} />
                            </View>
                            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                                Keep your profile up to date for a better experience with deliveries and orders.
                            </Text>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        zIndex: 0,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 44,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        padding: 3,
        marginBottom: 12,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 18,
        overflow: 'hidden',
    },
    cameraButtonGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    changePhotoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    formCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        height: 54,
        paddingHorizontal: 14,
    },
    inputIconContainer: {
        width: 28,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
        marginLeft: 8,
    },
    lockIconContainer: {
        marginLeft: 8,
    },
    rowInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    divider: {
        height: 1,
        marginVertical: 20,
    },
    saveButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        shadowColor: BRAND_NAVY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    saveButtonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    savingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
    },
    tipIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
});

export default EditProfileScreen;
