
import React, { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';

const VerifyEmailScreen = () => {
    const router = useRouter();
    const { userId: userIdParam } = useLocalSearchParams();
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
    const theme = useColorScheme() ?? 'light';
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');

    const handleVerify = async () => {
        if (code.length !== 4) {
            Alert.alert('Error', 'Please enter the 4-digit code.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    token: code,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert('Success', 'Email verified successfully!');
                router.replace('/edit-profile');
            } else {
                const errorMessage = Array.isArray(data.message) ? data.message.join('\n') : data.message;
                Alert.alert('Error', errorMessage || 'Something went wrong');
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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
                </View>
            </ThemedView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
});

export default VerifyEmailScreen;
