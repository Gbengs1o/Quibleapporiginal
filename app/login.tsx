import React, { useState } from 'react';
import { 
    View, 
    StyleSheet, 
    TextInput, 
    useColorScheme, 
    Image, 
    TouchableOpacity, 
    Text, 
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';

const LoginScreen = () => {
    const theme = useColorScheme() ?? 'light';
    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');
    const borderColor = useThemeColor({ light: '#E0E0E0', dark: '#3D3D5C' }, 'border');

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Validation functions
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = () => {
        if (validateForm()) {
            Alert.alert('Success', 'Logged in successfully!');
            // Handle login logic here
        } else {
            Alert.alert('Error', 'Please fix the errors in the form');
        }
    };

    const handleGoogleLogin = () => {
        Alert.alert('Google Login', 'Google login will be implemented');
        // Handle Google login logic here
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
                    
                    <ThemedText style={[styles.title, { color: labelColor }]}>WELCOME BACK</ThemedText>
                    
                    <Link href="/signup" style={styles.signupLink}>
                        <ThemedText style={[styles.signupLinkText, { color: labelColor }]}>SIGN UP</ThemedText>
                    </Link>

                    <View style={styles.form}>
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
                                    placeholder="Enter your password"
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
                    </View>

                    <View style={styles.rememberForgotContainer}>
                        <TouchableOpacity 
                            style={styles.rememberContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.checkbox,
                                { borderColor: labelColor },
                                rememberMe && styles.checkboxChecked
                            ]}>
                                {rememberMe && (
                                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                                )}
                            </View>
                            <ThemedText style={[styles.rememberText, { color: labelColor }]}>
                                Remember me
                            </ThemedText>
                        </TouchableOpacity>

                        <Link href="/forgot-password">
                            <ThemedText style={styles.forgotText}>Forgot Password?</ThemedText>
                        </Link>
                    </View>

                    <TouchableOpacity 
                        style={styles.loginButton}
                        onPress={handleLogin}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.loginButtonText}>Login</Text>
                    </TouchableOpacity>

                    <View style={styles.orContainer}>
                        <View style={[styles.line, { backgroundColor: borderColor }]} />
                        <ThemedText style={[styles.orText, { color: labelColor }]}>or</ThemedText>
                        <View style={[styles.line, { backgroundColor: borderColor }]} />
                    </View>

                    <TouchableOpacity 
                        style={[styles.googleButton, { borderColor: labelColor }]}
                        onPress={handleGoogleLogin}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.googleButtonText, { color: labelColor }]}>Continue with Google</Text>
                    </TouchableOpacity>

                    <View style={styles.signupPrompt}>
                        <ThemedText style={[styles.signupPromptText, { color: labelColor }]}>
                            Don't have an account?{' '}
                        </ThemedText>
                        <Link href="/signup">
                            <ThemedText style={styles.signupPromptLink}>Sign Up</ThemedText>
                        </Link>
                    </View>

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
        marginBottom: 30,
    },
    logo: {
        width: 53,
        height: 49,
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
    signupLink: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    signupLinkText: {
        fontSize: 20,
        fontFamily: 'OpenSans_700Bold',
    },
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
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
    rememberForgotContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    rememberContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderRadius: 4,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#1F2050',
        borderColor: '#1F2050',
    },
    checkmark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    rememberText: {
        fontSize: 14,
        fontFamily: 'OpenSans_400Regular',
    },
    forgotText: {
        fontSize: 14,
        fontFamily: 'OpenSans_600SemiBold',
        color: '#F58220',
        textDecorationLine: 'underline',
    },
    loginButton: {
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
    loginButtonText: {
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
        marginBottom: 30,
    },
    googleButtonText: {
        fontSize: 18,
        fontFamily: 'OpenSans_600SemiBold',
    },
    signupPrompt: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signupPromptText: {
        fontSize: 15,
        fontFamily: 'OpenSans_400Regular',
    },
    signupPromptLink: {
        fontSize: 15,
        fontFamily: 'OpenSans_700Bold',
        color: '#F58220',
        textDecorationLine: 'underline',
    },
});

export default LoginScreen;