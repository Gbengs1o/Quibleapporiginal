import React, { useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    useColorScheme,
} from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

const ResetPasswordScreen = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const theme = useColorScheme() ?? 'light';

    const handleResetPassword = async () => {
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
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

    const backgroundColor = useThemeColor({ light: '#F8F8F8', dark: '#000' }, 'background');
    const labelColor = useThemeColor({ light: '#333', dark: '#FFF' }, 'text');
    const inputBgColor = useThemeColor({ light: '#FFF', dark: '#1C1C1E' }, 'card');
    const inputBorderColor = useThemeColor({ light: '#E0E0E0', dark: '#38383A' }, 'border');
    const inputTextColor = useThemeColor({ light: '#000', dark: '#FFF' }, 'text');

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <ThemedText style={styles.title}>Reset Password</ThemedText>
                    
                    <View style={styles.card}>
                        <ThemedText style={[styles.description, { color: labelColor }]}>
                            Enter your new password below.
                        </ThemedText>

                        <TextInput
                            style={[
                                styles.input,
                                { 
                                    backgroundColor: inputBgColor, 
                                    borderColor: inputBorderColor, 
                                    color: inputTextColor 
                                }
                            ]}
                            placeholder="New Password"
                            placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <TextInput
                            style={[
                                styles.input,
                                { 
                                    backgroundColor: inputBgColor, 
                                    borderColor: inputBorderColor, 
                                    color: inputTextColor 
                                }
                            ]}
                            placeholder="Confirm New Password"
                            placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />

                        <TouchableOpacity 
                            style={styles.resetButton}
                            onPress={handleResetPassword}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            <Text style={styles.resetButtonText}>{loading ? 'Resetting...' : 'Set New Password'}</Text>
                        </TouchableOpacity>
                    </View>
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
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 32,
    },
    card: {
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 20,
    },
    resetButton: {
        backgroundColor: '#1F2050',
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1F2050',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default ResetPasswordScreen;
