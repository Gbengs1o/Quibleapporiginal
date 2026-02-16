import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
    View
} from 'react-native';

const LoginScreen = () => {
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';
    const { session } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (session) {
            router.replace('/(tabs)/Home');
        }
    }, [session, router]);

    const backgroundColor = useThemeColor({ light: '#F8F9FC', dark: '#0D0D1A' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'card');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#F5F6FA', dark: '#252538' }, 'background');
    const inputBorderColor = useThemeColor({ light: '#E8E9F0', dark: '#38384A' }, 'border');
    const inputTextColor = useThemeColor({ light: '#1F2050', dark: '#FFF' }, 'text');
    const borderColor = useThemeColor({ light: '#E0E0E0', dark: '#3D3D5C' }, 'border');

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Error', error.message);
        }

        setIsLoading(false);
    };

    const handleGoogleLogin = async () => {
        try {
            setIsLoading(true);
            const redirectUrl = Linking.createURL('/(auth)/callback');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success' && result.url) {
                    // Extract tokens from the URL if needed, 
                    // but usually the deep link listener in _layout.tsx will catch it 
                    // and set the session via supabase.auth.setSession

                    // We can also parse it manually here to be safe
                    const params: { [key: string]: string } = {};
                    const hashIndex = result.url.indexOf('#');
                    if (hashIndex !== -1) {
                        const hash = result.url.substring(hashIndex + 1);
                        hash.split('&').forEach(pair => {
                            const [key, value] = pair.split('=');
                            if (key && value) params[key] = decodeURIComponent(value);
                        });
                    }

                    if (params.access_token && params.refresh_token) {
                        await supabase.auth.setSession({
                            access_token: params.access_token,
                            refresh_token: params.refresh_token,
                        });
                    }
                }
            }
        } catch (error: any) {
            // Check for "User already registered" error
            if (error.message?.includes('registered') || error.message?.includes('identity')) {
                Alert.alert('Sign In Failed', 'This email is already registered with a different method (Password). Please log in with your password.');
            } else {
                Alert.alert('Error', error.message || 'Failed to sign in with Google');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo Section */}
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={['#1F2050', '#2D2F6D']}
                            style={styles.logoGradient}
                        >
                            <Ionicons name="restaurant" size={40} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.logoText}>Quible</Text>
                        <ThemedText style={[styles.tagline, { color: isDark ? '#888' : '#666' }]}>
                            Delicious food, delivered fresh
                        </ThemedText>
                    </View>

                    {/* Login Card */}
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.headerRow}>
                            <ThemedText style={[styles.title, { color: labelColor }]}>Welcome Back</ThemedText>
                            <Link href="/signup">
                                <ThemedText style={styles.signupLink}>Create Account</ThemedText>
                            </Link>
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Email Address</ThemedText>
                            <View style={[styles.inputWrapper, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                <Ionicons name="mail-outline" size={20} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholder="john.doe@example.com"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Password</ThemedText>
                            <View style={[styles.inputWrapper, { backgroundColor: inputBgColor, borderColor: inputBorderColor }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
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

                        {/* Forgot Password */}
                        <Link href="/forgot-password" asChild>
                            <TouchableOpacity style={styles.forgotPasswordButton}>
                                <ThemedText style={styles.forgotPasswordText}>Forgot Password?</ThemedText>
                            </TouchableOpacity>
                        </Link>

                        {/* Login Button */}
                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#1F2050', '#2D2F6D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="log-in-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.loginButtonText}>Sign In</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.orContainer}>
                            <View style={[styles.line, { backgroundColor: borderColor }]} />
                            <ThemedText style={[styles.orText, { color: isDark ? '#666' : '#999' }]}>or</ThemedText>
                            <View style={[styles.line, { backgroundColor: borderColor }]} />
                        </View>

                        <TouchableOpacity
                            style={[styles.googleButton, { borderColor: isDark ? '#3D3D5C' : '#E0E0E0' }]}
                            onPress={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            <Ionicons name="logo-google" size={22} color={isDark ? '#fff' : '#1F2050'} style={{ marginRight: 10 }} />
                            <Text style={[styles.googleButtonText, { color: labelColor }]}>Continue with Google</Text>
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
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logoGradient: {
        width: 80,
        height: 80,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 12,
    },
    logoText: {
        fontSize: 36,
        fontFamily: 'Montserrat_700Bold',
        color: '#F58220',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 14,
    },
    card: {
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    signupLink: {
        color: '#F58220',
        fontSize: 14,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 18,
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
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 54,
        fontSize: 16,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#F58220',
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
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
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    orContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    line: {
        flex: 1,
        height: 1,
    },
    orText: {
        marginHorizontal: 15,
        fontSize: 14,
        fontWeight: '500',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderRadius: 14,
        paddingVertical: 14,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;
