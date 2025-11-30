
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    useColorScheme,
    TouchableOpacity,
    Text,
    Alert,
    ActivityIndicator,
    ScrollView,
    Keyboard
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/auth';

const VerifyEmailScreen = () => {
    const router = useRouter();
    const { userId: userIdParam } = useLocalSearchParams();
    const { user, session, isReady } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const [userId] = useState(() => {
        const param = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
        return param || (user?.id ? user.id.toString() : undefined);
    });

    const [code, setCode] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const timerRef = useRef<NodeJS.Timeout>();

    const theme = useColorScheme() ?? 'light';
    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');

    useEffect(() => {
        if (resendCooldown > 0) {
            timerRef.current = setInterval(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [resendCooldown]);

    const handleVerify = useCallback(async () => {
        Keyboard.dismiss();
        if (code.length !== 4) {
            Alert.alert('Error', 'Please enter the 4-digit code.');
            return;
        }
        if (!userId) {
            Alert.alert('Error', 'User ID not found. Please go back and try again.');
            return;
        }
        setIsLoading(true);
        // const result = await verifyEmail(userId, code);
        // if (result.success) {
        //     Alert.alert('Success', 'Email verified successfully!', [
        //         { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
        //     ]);
        // } else {
        //     Alert.alert('Error', result.message);
        // }
        setIsLoading(false);
    }, [code, userId, router]);

    const handleResend = useCallback(async () => {
        if (!userId) {
            Alert.alert('Error', 'User ID not found. Please go back and try again.');
            return;
        }
        setIsLoading(true);
        // const result = await resendVerificationEmail(userId);
        // Alert.alert(result.success ? 'Success' : 'Error', result.message);
        // if (result.success) {
        //     setResendCooldown(60);
        // }
        setIsLoading(false);
    }, [userId]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor }}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.content}>
                <ThemedText style={[styles.title, { color: labelColor }]}>Verify Your Email</ThemedText>
                <ThemedText style={[styles.subtitle, { color: labelColor }]}>
                    A 4-digit verification code has been sent to your email address. Please enter it below.
                </ThemedText>

                <TextInput
                    style={[styles.input, { color: inputColor, backgroundColor: inputBgColor }]}
                    value={code}
                    onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="1234"
                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                />

                <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={handleVerify}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.verifyButtonText}>Verify Email</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.resendButton} 
                    onPress={handleResend} 
                    disabled={resendCooldown > 0 || isLoading}
                >
                    <ThemedText style={styles.resendButtonText}>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    title: {
        fontSize: 25,
        fontFamily: 'OpenSans_700Bold',
        textAlign: 'center',
        marginBottom: 15,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: 'OpenSans_400Regular',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    input: {
        borderRadius: 8,
        height: 54,
        paddingHorizontal: 15,
        fontSize: 20,
        fontFamily: 'OpenSans_600SemiBold',
        textAlign: 'center',
        letterSpacing: 10,
    },
    verifyButton: {
        backgroundColor: '#1F2050',
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 30,
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: 0.5,
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendButtonText: {
        color: '#F58220',
        fontSize: 16,
        fontFamily: 'OpenSans_600SemiBold',
        textDecorationLine: 'underline',
    },
});

export default VerifyEmailScreen;
