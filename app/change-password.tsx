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
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';

const ChangePasswordScreen = () => {
    const theme = useColorScheme() ?? 'light';
    const router = useRouter();
    const inputColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#1A1A2E' }, 'background');
    const labelColor = useThemeColor({ light: '#1F2050', dark: '#E0E0E0' }, 'text');
    const inputBgColor = useThemeColor({ light: '#EBECF0', dark: '#2D2D44' }, 'background');

    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState({
        new: false,
        confirm: false
    });
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your new password';
        } else if (formData.confirmPassword !== formData.newPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChangePassword = async () => {
        if (validateForm()) {
            setIsLoading(true);
            const { error } = await supabase.auth.updateUser({ 
                password: formData.newPassword 
            });

            setIsLoading(false);

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert(
                    'Success',
                    'Your password has been changed successfully.',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
                setFormData({
                    newPassword: '',
                    confirmPassword: ''
                });
            }
        } 
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const togglePasswordVisibility = (field: 'new' | 'confirm') => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
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
                        CHANGE PASSWORD
                    </ThemedText>

                    <ThemedText style={[styles.description, { color: labelColor }]}>
                        Choose a new secure password.
                    </ThemedText>

                    <View style={styles.form}>
                        {/* New Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>
                                New Password *
                            </ThemedText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={[
                                        styles.input, 
                                        styles.passwordInput,
                                        { color: inputColor, backgroundColor: inputBgColor },
                                        errors.newPassword && styles.inputError
                                    ]}
                                    value={formData.newPassword}
                                    onChangeText={(text) => updateField('newPassword', text)}
                                    secureTextEntry={!showPasswords.new}
                                    placeholder="Enter your new password"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                <TouchableOpacity 
                                    style={styles.eyeIcon}
                                    onPress={() => togglePasswordVisibility('new')}
                                >
                                    <ThemedText style={[styles.eyeText, { color: inputColor }]}>
                                        {showPasswords.new ? '👁️' : '👁️‍🗨️'}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                            {errors.newPassword && (
                                <ThemedText style={styles.errorText}>{errors.newPassword}</ThemedText>
                            )}
                        </View>

                        {/* Confirm New Password */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: labelColor }]}>
                                Confirm New Password *
                            </ThemedText>
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
                                    secureTextEntry={!showPasswords.confirm}
                                    placeholder="Confirm your new password"
                                    placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
                                />
                                <TouchableOpacity 
                                    style={styles.eyeIcon}
                                    onPress={() => togglePasswordVisibility('confirm')}
                                >
                                    <ThemedText style={[styles.eyeText, { color: inputColor }]}>
                                        {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && (
                                <ThemedText style={styles.errorText}>{errors.confirmPassword}</ThemedText>
                            )}
                        </View>

                        {/* Password Requirements */}
                        <View style={styles.requirementsContainer}>
                            <ThemedText style={[styles.requirementsTitle, { color: labelColor }]}>
                                Password Requirements:
                            </ThemedText>
                            <ThemedText style={[styles.requirement, { color: labelColor }]}>
                                • At least 8 characters long
                            </ThemedText>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={styles.changeButton}
                        onPress={handleChangePassword}
                        activeOpacity={0.8}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.changeButtonText}>Change Password</Text>
                        )}
                    </TouchableOpacity>
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
    requirementsContainer: {
        backgroundColor: 'rgba(245, 130, 32, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: '#F58220',
        padding: 15,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 20,
    },
    requirementsTitle: {
        fontSize: 14,
        fontFamily: 'OpenSans_600SemiBold',
        marginBottom: 8,
    },
    requirement: {
        fontSize: 13,
        fontFamily: 'OpenSans_400Regular',
        marginBottom: 4,
        lineHeight: 18,
    },
    changeButton: {
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
    changeButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: 0.5,
    },
});

export default ChangePasswordScreen;
