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
    Alert
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';

const ForgotPasswordScreen = () => {
    const theme = useColorScheme() ?? 'light';
    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');

    // Form state
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Validation function
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleResetPassword = () => {
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        
        if (!validateEmail(email)) {
            setError('Invalid email address');
            return;
        }

        // Handle password reset logic here
        setIsSubmitted(true);
        Alert.alert(
            'Success', 
            'If an account exists with this email, you will receive password reset instructions.'
        );
    };

    const handleEmailChange = (text: string) => {
        setEmail(text);
        if (error) {
            setError('');
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
                    
                    <ThemedText style={[styles.title, { color: labelColor }]}>
                        FORGOT PASSWORD
                    </ThemedText>

                    {!isSubmitted ? (
                        <>
                            <ThemedText style={[styles.description, { color: labelColor }]}>
                                Enter your email address and we&apos;ll send you instructions to reset your password.
                            </ThemedText>

                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <ThemedText style={[styles.label, { color: labelColor }]}>
                                        Email Address *
                                    </ThemedText>
                                    <TextInput 
                                        style={[
                                            styles.input, 
                                            { color: inputColor, backgroundColor: inputBgColor },
                                            error && styles.inputError
                                        ]}
                                        value={email}
                                        onChangeText={handleEmailChange}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        placeholder="john.doe@example.com"
                                        placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                    />
                                    {error && (
                                        <ThemedText style={styles.errorText}>{error}</ThemedText>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={styles.resetButton}
                                onPress={handleResetPassword}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.resetButtonText}>Reset Password</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.successContainer}>
                            <ThemedText style={[styles.successIcon, { color: labelColor }]}>
                                ✉️
                            </ThemedText>
                            <ThemedText style={[styles.successText, { color: labelColor }]}>
                                Check your email for password reset instructions.
                            </ThemedText>
                        </View>
                    )}

                    <View style={styles.backToLoginContainer}>
                        <Link href="/login">
                            <ThemedText style={styles.backToLoginText}>
                                ← Back to Login
                            </ThemedText>
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
    logoText: {
        fontSize: 25,
        fontFamily: 'Montserrat_600SemiBold',
        color: '#F58220',
    },
    title: {
        fontSize: 25,
        fontFamily: 'OpenSans_700Bold',
        marginBottom: 15,
    },
    description: {
        fontSize: 14,
        fontFamily: 'OpenSans_400Regular',
        marginBottom: 30,
        lineHeight: 20,
    },
    form: {
        width: '100%',
        marginBottom: 30,
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
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: 5,
        fontFamily: 'OpenSans_400Regular',
    },
    resetButton: {
        backgroundColor: '#1F2050',
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: 0.5,
    },
    successContainer: {
        alignItems: 'center',
        marginVertical: 40,
    },
    successIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    successText: {
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
        textAlign: 'center',
        lineHeight: 24,
    },
    backToLoginContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    backToLoginText: {
        fontSize: 15,
        fontFamily: 'OpenSans_600SemiBold',
        color: '#F58220',
        textDecorationLine: 'underline',
    },
});

export default ForgotPasswordScreen;