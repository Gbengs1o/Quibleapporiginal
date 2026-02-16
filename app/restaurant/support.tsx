import FoodLoader from '@/components/FoodLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupportScreen() {
    const { openMenu } = useRestaurantMenu();
    const { user } = useAuth();
    const iconColor = useThemeColor({ light: '#1E2050', dark: '#FFFFFF' }, 'text');
    const inputBg = useThemeColor({ light: '#F5F5F5', dark: '#1e1e1e' }, 'background');
    const textColor = useThemeColor({ light: '#1d1d1f', dark: '#f5f5f7' }, 'text');

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [chatId, setChatId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        if (user) {
            fetchConfig();
            setupSupportChat();
        }
    }, [user]);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('support_config')
                .select('*')
                .single();

            if (data) {
                setConfig(data);
            }
        } catch (error) {
            console.error('Error fetching support config:', error);
        }
    };

    const setupSupportChat = async () => {
        try {
            // Check for existing support chat (we'll look for a chat where user_id = user.id and rider_id is null/placeholder)
            // For now, we'll try to find a chat with a specific topic or just create one.
            const { data: existingChats, error: chatError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', user?.id)
                .is('rider_id', null)
                .is('request_id', null)
                .limit(1);

            let activeChatId = '';

            if (existingChats && existingChats.length > 0) {
                activeChatId = existingChats[0].id;
            } else {
                // Create a new support chat
                const { data: newChat, error: createError } = await supabase
                    .from('chats')
                    .insert({
                        user_id: user?.id,
                        rider_id: null, // Admin/System
                        request_id: null
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                activeChatId = newChat.id;
            }

            setChatId(activeChatId);
            fetchMessages(activeChatId);
            subscribeToMessages(activeChatId);
        } catch (error) {
            console.error('Error setting up support chat:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (id: string) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            setMessages(data || []);
        }
    };

    const subscribeToMessages = (id: string) => {
        const subscription = supabase
            .channel(`support_chat:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${id}`,
            }, (payload) => {
                setMessages((prev) => [...prev, payload.new]);
                setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !chatId || !user) return;

        const newMessage = {
            chat_id: chatId,
            sender_id: user.id,
            content: inputText.trim(),
            topic: 'support'
        };

        setInputText('');

        const { error } = await supabase
            .from('messages')
            .insert(newMessage);

        if (error) {
            console.error('Error sending message:', error);
        }
    };

    if (loading) return <FoodLoader message="Connecting to support..." />;

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.sender_id === user?.id;
        return (
            <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
                <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                    <ThemedText style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
                        {item.content}
                    </ThemedText>
                    <ThemedText style={styles.timeText}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                </View>
            </View>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={openMenu} style={styles.headerIcon}>
                        <Ionicons name="menu" size={28} color={iconColor} />
                    </TouchableOpacity>
                    <View style={styles.headerTitle}>
                        <ThemedText style={styles.titleText}>Support Admin</ThemedText>
                        <View style={styles.statusRow}>
                            <View style={styles.onlineDot} />
                            <ThemedText style={styles.statusText}>Online</ThemedText>
                        </View>
                    </View>

                    {/* Dynamic Contact Buttons */}
                    <View style={{ flexDirection: 'row', gap: 15 }}>
                        {config?.whatsapp_enabled && (
                            <TouchableOpacity onPress={() => Linking.openURL(`whatsapp://send?phone=${config?.whatsapp_number}`)}>
                                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                            </TouchableOpacity>
                        )}
                        {config?.call_center_enabled && (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${config?.call_center_number}`)}>
                                <Ionicons name="call" size={24} color={iconColor} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Chat Area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    />

                    {/* Input Area */}
                    <View style={styles.inputArea}>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="Type reaching to support..."
                            placeholderTextColor="#888"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                            <Ionicons name="send" size={24} color="#f27c22" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
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
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerIcon: { padding: 5 },
    headerTitle: { alignItems: 'center' },
    titleText: { fontSize: 18, fontWeight: 'bold' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3CBD54', marginRight: 5 },
    statusText: { fontSize: 12, opacity: 0.7 },
    messagesList: { padding: 20, paddingBottom: 40 },
    messageWrapper: { marginBottom: 20, flexDirection: 'row' },
    myMessageWrapper: { justifyContent: 'flex-end' },
    otherMessageWrapper: { justifyContent: 'flex-start' },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
    myBubble: { backgroundColor: '#f27c22', borderBottomRightRadius: 4 },
    otherBubble: { backgroundColor: '#f0f0f0', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 15 },
    myText: { color: '#fff' },
    otherText: { color: '#1a1a1a' },
    timeText: { fontSize: 10, opacity: 0.5, marginTop: 4, textAlign: 'right' },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'transparent'
    },
    input: {
        flex: 1,
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: 15,
        maxHeight: 100,
    },
    sendBtn: { marginLeft: 15, padding: 5 },
});
