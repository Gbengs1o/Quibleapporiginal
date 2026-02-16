import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function FeedbackScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const iconColor = useThemeColor({ light: '#1F2050', dark: '#fff' }, 'text');
    const inputBg = useThemeColor({ light: '#F5F5F5', dark: '#1e1e1e' }, 'background');
    const textColor = useThemeColor({ light: '#1d1d1f', dark: '#f5f5f7' }, 'text');

    const [type, setType] = useState<'bug' | 'improvement' | 'other'>('improvement');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Error', 'Please enter a message');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'You must be logged in to send feedback');
            return;
        }

        try {
            setSubmitting(true);
            const { error } = await supabase
                .from('feedback')
                .insert({
                    user_id: user.id,
                    type,
                    message: message.trim(),
                    status: 'open'
                });

            if (error) throw error;

            Alert.alert(
                'Thank You!',
                'Your feedback has been received. We appreciate your input!',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error) {
            console.error('Error sending feedback:', error);
            Alert.alert('Error', 'Failed to send feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={iconColor} />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Help & Feedback</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <ThemedText style={styles.subtitle}>
                        We value your feedback! Let us know how we can improve.
                    </ThemedText>

                    <View style={styles.typeContainer}>
                        <TouchableOpacity
                            style={[styles.typeButton, type === 'bug' && styles.activeType]}
                            onPress={() => setType('bug')}
                        >
                            <Ionicons name="bug-outline" size={20} color={type === 'bug' ? '#fff' : iconColor} />
                            <ThemedText style={[styles.typeText, type === 'bug' && styles.activeTypeText]}>Bug Report</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.typeButton, type === 'improvement' && styles.activeType]}
                            onPress={() => setType('improvement')}
                        >
                            <Ionicons name="bulb-outline" size={20} color={type === 'improvement' ? '#fff' : iconColor} />
                            <ThemedText style={[styles.typeText, type === 'improvement' && styles.activeTypeText]}>Suggestion</ThemedText>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                        placeholder="Describe your feedback here..."
                        placeholderTextColor="#999"
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <ThemedText style={styles.submitText}>Submit Feedback</ThemedText>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 20, textAlign: 'center' },
    typeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 25,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#ddd',
        gap: 8,
    },
    activeType: {
        backgroundColor: '#F27C22',
        borderColor: '#F27C22',
    },
    typeText: { fontWeight: '600' },
    activeTypeText: { color: '#fff' },
    input: {
        height: 200,
        borderRadius: 15,
        padding: 15,
        fontSize: 16,
        marginBottom: 30,
    },
    submitButton: {
        backgroundColor: '#1F2050',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: { opacity: 0.7 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
