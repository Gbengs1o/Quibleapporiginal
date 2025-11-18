
import { supabase } from '@/utils/supabase';
import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    useColorScheme,
    TouchableOpacity,
    Text,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';

const SignupScreen = () => {
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';
    const [isLoading, setIsLoading] = useState(false);
    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');
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

    const handleGoogleSignup = () => {
        Alert.alert('Google Signup', 'Google signup will be implemented');
        // Handle Google signup logic here
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field when user starts typing
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
                    <View style={styles.header}>
                        
                        <ThemedText style={styles.logoText}>Quible</ThemedText>
                    </View>
                    
                    <ThemedText style={[styles.title, { color: labelColor }]}>CREATE AN ACCOUNT</ThemedText>
                    
                    <Link href="/login" style={styles.loginLink}>
                        <ThemedText style={[styles.loginLinkText, { color: labelColor }]}>LOGIN</ThemedText>
                    </Link>

                    <View style={styles.form}>
                        <View style={styles.nameContainer}>
                            <View style={[styles.inputGroup, styles.halfInputGroup]}>
                                <ThemedText style={[styles.label, { color: labelColor }]}>First name *</ThemedText>
                                <TextInput 
                                    style={[
                                        styles.input, 
                                        styles.halfInput, 
                                        { color: inputColor, backgroundColor: inputBgColor },
                                        errors.firstName && styles.inputError
                                    ]}
                                    value={formData.firstName}
                                    onChangeText={(text) => updateField('firstName', text)}
                                    placeholder="John"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                {errors.firstName && (
                                    <ThemedText style={styles.errorText}>{errors.firstName}</ThemedText>
                                )}
                            </View>
                            
                            <View style={[styles.inputGroup, styles.halfInputGroup]}>
                                <ThemedText style={[styles.label, { color: labelColor }]}>Last name *</ThemedText>
                                <TextInput 
                                    style={[
                                        styles.input, 
                                        styles.halfInput, 
                                        { color: inputColor, backgroundColor: inputBgColor },
                                        errors.lastName && styles.inputError
                                    ]}
                                    value={formData.lastName}
                                    onChangeText={(text) => updateField('lastName', text)}
                                    placeholder="Doe"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                {errors.lastName && (
                                    <ThemedText style={styles.errorText}>{errors.lastName}</ThemedText>
                                )}
                            </View>
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Phone number *</ThemedText>
                            <TextInput 
                                style={[
                                    styles.input, 
                                    { color: inputColor, backgroundColor: inputBgColor },
                                    errors.phoneNumber && styles.inputError
                                ]}
                                value={formData.phoneNumber}
                                onChangeText={(text) => updateField('phoneNumber', text.replace(/[^0-9]/g, ''))}
                                keyboardType="phone-pad"
                                placeholder="e.g. +1234567890"
                                placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                maxLength={15}
                            />
                            {errors.phoneNumber && (
                                <ThemedText style={styles.errorText}>{errors.phoneNumber}</ThemedText>
                            )}
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Email Address *</ThemedText>
                            <TextInput 
                                style={[
                                    styles.input, 
                                    { color: inputColor, backgroundColor: inputBgColor },
                                    errors.email && styles.inputError
                                ]}
                                value={formData.email}
                                onChangeText={(text) => updateField('email', text)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder="john.doe@example.com"
                                placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                            />
                            {errors.email && (
                                <ThemedText style={styles.errorText}>{errors.email}</ThemedText>
                            )}
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Password *</ThemedText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={[
                                        styles.input, 
                                        styles.passwordInput,
                                        { color: inputColor, backgroundColor: inputBgColor },
                                        errors.password && styles.inputError
                                    ]}
                                    value={formData.password}
                                    onChangeText={(text) => updateField('password', text)}
                                    secureTextEntry={!showPassword}
                                    placeholder="Min. 8 characters"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                <TouchableOpacity 
                                    style={styles.eyeIcon}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    <ThemedText style={[styles.eyeText, { color: inputColor }]}>
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                            {errors.password && (
                                <ThemedText style={styles.errorText}>{errors.password}</ThemedText>
                            )}
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>Confirm Password *</ThemedText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={[
                                        styles.input, 
                                        styles.passwordInput,
                                        { color: inputColor, backgroundColor: inputBgColor },
                                        errors.confirmPassword && styles.inputError
                                    ]}
                                    value={formData.confirmPassword}
                                    onChangeText={(text) => updateField('confirmPassword', text)}
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="Re-enter password"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                <TouchableOpacity 
                                    style={styles.eyeIcon}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    <ThemedText style={[styles.eyeText, { color: inputColor }]}>
                                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && (
                                <ThemedText style={styles.errorText}>{errors.confirmPassword}</ThemedText>
                            )}
                        </View>
                    </View>

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
                            { borderColor: labelColor },
                            agreedToTerms && styles.checkboxChecked,
                            errors.terms && styles.checkboxError
                        ]}>
                            {agreedToTerms && (
                                <ThemedText style={styles.checkmark}>✓</ThemedText>
                            )}
                        </View>
                        <ThemedText style={[styles.termsText, { color: labelColor }]}>
                            By proceeding, you agree to our{' '}
                            <ThemedText style={styles.linkText}>Terms of use</ThemedText>
                            {' '}and{' '}
                            <ThemedText style={styles.linkText}>privacy policy</ThemedText>
                        </ThemedText>
                    </TouchableOpacity>
                    {errors.terms && (
                        <ThemedText style={[styles.errorText, { marginTop: -10, marginBottom: 10 }]}>
                            {errors.terms}
                        </ThemedText>
                    )}

                    <TouchableOpacity 
                        style={styles.continueButton}
                        onPress={handleContinue}
                        activeOpacity={0.8}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.continueButtonText}>Continue</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.orContainer}>
                        <View style={[styles.line, { backgroundColor: borderColor }]} />
                        <ThemedText style={[styles.orText, { color: labelColor }]}>or</ThemedText>
                        <View style={[styles.line, { backgroundColor: borderColor }]} />
                    </View>

                    <TouchableOpacity 
                        style={[styles.googleButton, { borderColor: labelColor }]}
                        onPress={handleGoogleSignup}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.googleButtonText, { color: labelColor }]}>Continue with Google</Text>
                    </TouchableOpacity>

                    {/* Extra padding at bottom for better scroll */}
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
        paddingTop: 64,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    logoText: {
        fontSize: 25,
        fontFamily: 'Montserrat_600SemiBold',
        color: '#F58220',
        marginLeft: 10,
    },
    title: {
        fontSize: 25,
        fontFamily: 'OpenSans_700Bold',
        marginBottom: 10,
    },
    loginLink: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    loginLinkText: {
        fontSize: 20,
        fontFamily: 'OpenSans_700Bold',
    },
    form: {
        width: '100%',
    },
    nameContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    inputGroup: {
        marginBottom: 20,
    },
    halfInputGroup: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
        marginBottom: 8,
    },
    input: {
        borderRadius: 8,
        height: 54,
        paddingHorizontal: 15,
        fontSize: 16,
        fontFamily: 'OpenSans_400Regular',
    },
    inputError: {
        borderWidth: 2,
        borderColor: '#FF3B30',
    },
    halfInput: {
        width: '100%',
    },
    passwordContainer: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 50,
    },
    eyeIcon: {
        position: 'absolute',
        right: 15,
        top: 15,
        padding: 5,
    },
    eyeText: {
        fontSize: 20,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: 5,
        fontFamily: 'OpenSans_400Regular',
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 20,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderRadius: 4,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: '#1F2050',
        borderColor: '#1F2050',
    },
    checkboxError: {
        borderColor: '#FF3B30',
    },
    checkmark: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'OpenSans_400Regular',
    },
    linkText: {
        color: '#F58220',
        textDecorationLine: 'underline',
        fontFamily: 'OpenSans_600SemiBold',
    },
    continueButton: {
        backgroundColor: '#1F2050',
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: 0.5,
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
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
    },
    googleButton: {
        borderWidth: 2,
        borderRadius: 28,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleButtonText: {
        fontSize: 18,
        fontFamily: 'OpenSans_600SemiBold',
    },
});

export default SignupScreen;
