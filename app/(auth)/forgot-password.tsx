import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React, { useState } from 'react';
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

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address.');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'quible://reset-password',
        });

        setLoading(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setIsSubmitted(true);
        }
    };

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
                            <Ionicons name="lock-closed-outline" size={48} color="#fff" />
                        </LinearGradient>
                    </View>

                    <ThemedText style={[styles.title, { color: labelColor }]}>
                        Forgot Password?
                    </ThemedText>
                    <ThemedText style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
                        No worries! Enter your email and we'll send you reset instructions.
                    </ThemedText>

                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {!isSubmitted ? (
                            <>
                                {/* Email Input */}
                                <View style={styles.inputGroup}>
                                    <ThemedText style={[styles.label, { color: labelColor }]}>
                                        Email Address
                                    </ThemedText>
                                    <View style={[styles.inputWrapper, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                        <Ionicons name="mail-outline" size={20} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: inputTextColor }]}
                                            placeholder="Enter your email"
                                            placeholderTextColor={isDark ? '#666' : '#999'}
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
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
                                                <Ionicons name="send-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.resetButtonText}>Send Reset Link</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.successContainer}>
                                <View style={styles.successIconWrapper}>
                                    <LinearGradient
                                        colors={['#22C55E', '#16A34A']}
                                        style={styles.successIconGradient}
                                    >
                                        <Ionicons name="checkmark" size={40} color="#fff" />
                                    </LinearGradient>
                                </View>
                                <ThemedText style={[styles.successTitle, { color: labelColor }]}>
                                    Check Your Email
                                </ThemedText>
                                <ThemedText style={[styles.successText, { color: isDark ? '#888' : '#666' }]}>
                                    We've sent password reset instructions to {email}
                                </ThemedText>
                            </View>
                        )}
                    </View>

                    {/* Back to Login */}
                    <Link href="/login" asChild>
                        <TouchableOpacity style={styles.backButton}>
                            <Ionicons name="arrow-back" size={20} color="#1F2050" />
                            <ThemedText style={[styles.backButtonText, { color: '#1F2050' }]}>
                                Back to Login
                            </ThemedText>
                        </TouchableOpacity>
                    </Link>

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
        paddingHorizontal: 20,
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
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successIconWrapper: {
        marginBottom: 20,
    },
    successIconGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    successText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        gap: 8,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ForgotPasswordScreen;
