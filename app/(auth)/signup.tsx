import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
    View
} from 'react-native';

const SignupScreen = () => {
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';
    const [isLoading, setIsLoading] = useState(false);

    const backgroundColor = useThemeColor({ light: '#F8F9FC', dark: '#0D0D1A' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'card');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#F5F6FA', dark: '#252538' }, 'background');
    const inputBorderColor = useThemeColor({ light: '#E8E9F0', dark: '#38384A' }, 'border');
    const inputTextColor = useThemeColor({ light: '#1F2050', dark: '#FFF' }, 'text');
    const borderColor = useThemeColor({ light: '#E0E0E0', dark: '#3D3D5C' }, 'border');

    // Form state
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Validation functions
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string) => {
        return phone.length >= 10;
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.phoneNumber.trim()) {
            newErrors.phoneNumber = 'Phone number is required';
        } else if (!validatePhone(formData.phoneNumber)) {
            newErrors.phoneNumber = 'Invalid phone number';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!validateEmail(formData.email)) {
            newErrors.email = 'Invalid email address';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        if (!agreedToTerms) {
            newErrors.terms = 'You must agree to the terms';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleContinue = async () => {
        if (validateForm()) {
            setIsLoading(true);
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone_number: formData.phoneNumber,
                    }
                }
            });

            if (error) {
                Alert.alert('Error', error.message);
            } else if (data.user) {
                Alert.alert('Success', 'Please check your email for a verification link.');
                router.push('/login');
            }
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
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
                        // Depending on app flow, might want to redirect to onboarding or edit profile
                        // usually the session listener in layout or login will handle it, but here we can force it
                        router.replace('/edit-profile');
                    }
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign up with Google');
        } finally {
            setIsLoading(false);
        }
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
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
                            <Ionicons name="person-add" size={36} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.logoText}>Quible</Text>
                    </View>

                    {/* Signup Card */}
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.headerRow}>
                            <ThemedText style={[styles.title, { color: labelColor }]}>Create Account</ThemedText>
                            <Link href="/login">
                                <ThemedText style={styles.loginLink}>Sign In</ThemedText>
                            </Link>
                        </View>

                        {/* Name Row */}
                        <View style={styles.nameRow}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <ThemedText style={[styles.label, { color: labelColor }]}>First Name</ThemedText>
                                <View style={[
                                    styles.inputWrapper,
                                    { backgroundColor: inputBgColor, borderColor: errors.firstName ? '#FF3B30' : inputBorderColor }
                                ]}>
                                    <Ionicons name="person-outline" size={18} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: inputTextColor }]}
                                        value={formData.firstName}
                                        onChangeText={(text) => updateField('firstName', text)}
                                        placeholder="John"
                                        placeholderTextColor={isDark ? '#666' : '#999'}
                                    />
                                </View>
                                {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <ThemedText style={[styles.label, { color: labelColor }]}>Last Name</ThemedText>
                                <View style={[
                                    styles.inputWrapper,
                                    { backgroundColor: inputBgColor, borderColor: errors.lastName ? '#FF3B30' : inputBorderColor }
                                ]}>
                                    <TextInput
                                        style={[styles.input, { color: inputTextColor }]}
                                        value={formData.lastName}
                                        onChangeText={(text) => updateField('lastName', text)}
                                        placeholder="Doe"
                                        placeholderTextColor={isDark ? '#666' : '#999'}
                                    />
                                </View>
                                {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
                            </View>
                        </View>

                        {/* Phone Number */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Phone Number</ThemedText>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: inputBgColor, borderColor: errors.phoneNumber ? '#FF3B30' : inputBorderColor }
                            ]}>
                                <Ionicons name="call-outline" size={18} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={formData.phoneNumber}
                                    onChangeText={(text) => updateField('phoneNumber', text.replace(/[^0-9]/g, ''))}
                                    keyboardType="phone-pad"
                                    placeholder="+1234567890"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                    maxLength={15}
                                />
                            </View>
                            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                        </View>

                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Email Address</ThemedText>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: inputBgColor, borderColor: errors.email ? '#FF3B30' : inputBorderColor }
                            ]}>
                                <Ionicons name="mail-outline" size={18} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={formData.email}
                                    onChangeText={(text) => updateField('email', text)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholder="john.doe@example.com"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                />
                            </View>
                            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Password</ThemedText>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: inputBgColor, borderColor: errors.password ? '#FF3B30' : inputBorderColor }
                            ]}>
                                <Ionicons name="lock-closed-outline" size={18} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={formData.password}
                                    onChangeText={(text) => updateField('password', text)}
                                    secureTextEntry={!showPassword}
                                    placeholder="Min. 8 characters"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={20}
                                        color={isDark ? '#888' : '#999'}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Confirm Password</ThemedText>
                            <View style={[
                                styles.inputWrapper,
                                { backgroundColor: inputBgColor, borderColor: errors.confirmPassword ? '#FF3B30' : inputBorderColor }
                            ]}>
                                <Ionicons name="shield-checkmark-outline" size={18} color={isDark ? '#888' : '#999'} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: inputTextColor }]}
                                    value={formData.confirmPassword}
                                    onChangeText={(text) => updateField('confirmPassword', text)}
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="Re-enter password"
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={20}
                                        color={isDark ? '#888' : '#999'}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                        </View>

                        {/* Terms Checkbox */}
                        <TouchableOpacity
                            style={styles.termsContainer}
                            onPress={() => {
                                setAgreedToTerms(!agreedToTerms);
                                if (errors.terms) {
                                    setErrors(prev => ({ ...prev, terms: '' }));
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                { borderColor: errors.terms ? '#FF3B30' : (isDark ? '#555' : '#ddd') },
                                agreedToTerms && styles.checkboxChecked
                            ]}>
                                {agreedToTerms && (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                )}
                            </View>
                            <ThemedText style={[styles.termsText, { color: isDark ? '#888' : '#666' }]}>
                                I agree to the{' '}
                                <ThemedText style={styles.linkText}>Terms of Service</ThemedText>
                                {' '}and{' '}
                                <ThemedText style={styles.linkText}>Privacy Policy</ThemedText>
                            </ThemedText>
                        </TouchableOpacity>
                        {errors.terms && <Text style={[styles.errorText, { marginTop: -8, marginBottom: 12 }]}>{errors.terms}</Text>}

                        {/* Continue Button */}
                        <TouchableOpacity
                            onPress={handleContinue}
                            activeOpacity={0.8}
                            disabled={isLoading}
                        >
                            <LinearGradient
                                colors={['#1F2050', '#2D2F6D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.continueButtonText}>Create Account</Text>
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

                        {/* Google Button */}
                        <TouchableOpacity
                            style={[styles.googleButton, { borderColor: isDark ? '#3D3D5C' : '#E0E0E0' }]}
                            onPress={handleGoogleSignup}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-google" size={20} color={isDark ? '#fff' : '#1F2050'} style={{ marginRight: 10 }} />
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
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoGradient: {
        width: 70,
        height: 70,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 30,
        fontFamily: 'Montserrat_700Bold',
        color: '#F58220',
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
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    loginLink: {
        color: '#F58220',
        fontSize: 14,
        fontWeight: '600',
    },
    nameRow: {
        flexDirection: 'row',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: 15,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 11,
        marginTop: 4,
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 16,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderWidth: 2,
        borderRadius: 6,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: '#1F2050',
        borderColor: '#1F2050',
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
    },
    linkText: {
        color: '#F58220',
        fontWeight: '600',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
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
    continueButtonText: {
        color: '#fff',
        fontSize: 17,
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
        fontSize: 15,
        fontWeight: '600',
    },
});

export default SignupScreen;
