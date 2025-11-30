
import { supabase } from '@/utils/supabase';
import React, { useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    useColorScheme,
    TouchableOpacity,
    Text,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/auth';

const LoginScreen = () => {
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';
    const { session } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (session) {
            router.replace('/edit-profile');
        }
    }, [session, router]);

    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');
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

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <ThemedText style={styles.logoText}>Quible</ThemedText>
                </View>

                <ThemedText style={[styles.title, { color: labelColor }]}>LOGIN</ThemedText>
                
                <Link href="/signup" style={styles.signupLink}>
                    <ThemedText style={[styles.signupLinkText, { color: labelColor }]}>CREATE AN ACCOUNT</ThemedText>
                </Link>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <ThemedText style={[styles.label, { color: labelColor }]}>Email Address</ThemedText>
                        <TextInput 
                            style={[styles.input, { color: inputColor, backgroundColor: inputBgColor }]}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="john.doe@example.com"
                            placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                        />
                    </View>
                    
                    <View style={styles.inputGroup}>
                        <ThemedText style={[styles.label, { color: labelColor }]}>Password</ThemedText>
                        <View style={styles.passwordContainer}>
                            <TextInput 
                                style={[styles.input, styles.passwordInput, { color: inputColor, backgroundColor: inputBgColor }]}
                                value={password}
                                onChangeText={setPassword}
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
                    </View>

                    <Link href="/forgot-password" asChild>
                        <TouchableOpacity style={styles.forgotPasswordButton}>
                            <ThemedText style={styles.forgotPasswordText}>Forgot Password?</ThemedText>
                        </TouchableOpacity>
                    </Link>
                </View>

                <TouchableOpacity 
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginButtonText}>Login</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.orContainer}>
                    <View style={[styles.line, { backgroundColor: borderColor }]} />
                    <ThemedText style={[styles.orText, { color: labelColor }]}>or</ThemedText>
                    <View style={[styles.line, { backgroundColor: borderColor }]} />
                </View>

                <TouchableOpacity style={[styles.googleButton, { borderColor: labelColor }]}>
                    <Text style={[styles.googleButtonText, { color: labelColor }]}>Continue with Google</Text>
                </TouchableOpacity>
            </ThemedView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 64,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logoText: {
        fontSize: 30,
        fontFamily: 'Montserrat_700Bold',
        color: '#F58220',
    },
    title: {
        fontSize: 25,
        fontFamily: 'OpenSans_700Bold',
        marginBottom: 10,
    },
    signupLink: {
        alignSelf: 'flex-end',
        marginBottom: 20,
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
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#F58220',
        fontSize: 14,
        fontFamily: 'OpenSans_600SemiBold',
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
    },
    googleButtonText: {
        fontSize: 18,
        fontFamily: 'OpenSans_600SemiBold',
    },
});

export default LoginScreen;
