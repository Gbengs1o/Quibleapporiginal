import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';

const ResetPasswordScreen = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters.');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert(
                'Success',
                'Your password has been reset successfully.',
                [{ text: 'OK', onPress: () => router.replace('/login') }]
            );
        }
    };

    useEffect(() => {
        const handleUrl = async (url: string | null) => {
            if (!url) return;

            const extractParams = (urlStr: string) => {
                const params: { [key: string]: string } = {};
                const hashIndex = urlStr.indexOf('#');
                if (hashIndex !== -1) {
                    const hash = urlStr.substring(hashIndex + 1);
                    const pairs = hash.split('&');
                    for (const pair of pairs) {
                        const [key, value] = pair.split('=');
                        if (key && value) {
                            params[key] = decodeURIComponent(value);
                        }
                    }
                }
                return params;
            };

            const params = extractParams(url);

            if (params.access_token && params.refresh_token) {
                const { error } = await supabase.auth.setSession({
                    access_token: params.access_token,
                    refresh_token: params.refresh_token,
                });

                if (error) {
                    Alert.alert('Error', 'Failed to set session: ' + error.message);
                }
            } else if (params.error_description) {
                Alert.alert('Error', params.error_description.replace(/\+/g, ' '));
            }
        };

        Linking.getInitialURL().then(handleUrl);
        const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

        return () => {
            subscription.remove();
        };
    }, []);

    const backgroundColor = useThemeColor({ light: '#F8F9FC', dark: '#0D0D1A' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'card');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#F5F6FA', dark: '#252538' }, 'background');
    const inputBorderColor = useThemeColor({ light: '#E8E9F0', dark: '#38384A' }, 'border');
    const inputTextColor = useThemeColor({ light: '#1F2050', dark: '#FFF' }, 'text');

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Icon */}
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={['#1F2050', '#2D2F6D']}
                            style={styles.iconGradient}
                        >
                            <Ionicons name="key-outline" size={48} color="#fff" />
                        </LinearGradient>
                    </View>

                    <ThemedText style={[styles.title, { color: labelColor }]}>
                        Create New Password
                    </ThemedText>
                    <ThemedText style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
                        Your new password must be different from previously used passwords.
                    </ThemedText>

                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {/* New Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>
                                New Password
                            </ThemedText>
                            <View style={[styles.inputWrapper, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    placeholder="Min. 8 characters"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={22}
                                        color={isDark ? '#888' : '#999'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>
                                Confirm Password
                            </ThemedText>
                            <View style={[styles.inputWrapper, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    placeholder="Re-enter password"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={22}
                                        color={isDark ? '#888' : '#999'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Password Requirements */}
                        <View style={styles.requirementsContainer}>
                            <View style={styles.requirementRow}>
                                <Ionicons
                                    name={password.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={16}
                                    color={password.length >= 8 ? '#22C55E' : (isDark ? '#555' : '#ccc')}
                                />
                                <ThemedText style={[styles.requirementText, { color: isDark ? '#888' : '#666' }]}>
                                    At least 8 characters
                                </ThemedText>
                            </View>
                            <View style={styles.requirementRow}>
                                <Ionicons
                                    name={password === confirmPassword && password.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={16}
                                    color={password === confirmPassword && password.length > 0 ? '#22C55E' : (isDark ? '#555' : '#ccc')}
                                />
                                <ThemedText style={[styles.requirementText, { color: isDark ? '#888' : '#666' }]}>
                                    Passwords match
                                </ThemedText>
                            </View>
                        </View>

                        {/* Reset Button */}
                        <TouchableOpacity
                            onPress={handleResetPassword}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#1F2050', '#2D2F6D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.resetButton, loading && styles.buttonDisabled]}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-done-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.resetButtonText}>Reset Password</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </ThemedView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        paddingTop: 60,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    card: {
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 52,
        fontSize: 16,
    },
    requirementsContainer: {
        marginBottom: 24,
        gap: 8,
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requirementText: {
        fontSize: 13,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
});

export default ResetPasswordScreen;
