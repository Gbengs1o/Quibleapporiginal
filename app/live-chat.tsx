import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'support';
    timestamp: Date;
};

const INITIAL_MESSAGES: Message[] = [
    {
        id: '1',
        text: '👋 Welcome to Quible Support! How can we assist you today?',
        sender: 'support',
        timestamp: new Date(),
    },
    {
        id: '2',
        text: 'We typically respond within a few minutes. Feel free to describe your issue in detail.',
        sender: 'support',
        timestamp: new Date(),
    },
];

export default function LiveChatScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const lottieRef = useRef<LottieView>(null);
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Theme-aware colors
    const colors = {
        bg: isDark ? '#0A0A0F' : '#F4F5F9',
        cardBg: isDark ? '#1A1A22' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#1F2050',
        textSecondary: isDark ? '#8E8E93' : '#6B7280',
        textMuted: isDark ? '#636366' : '#9CA3AF',
        inputBg: isDark ? '#2C2C34' : '#FFFFFF',
        userBubble: '#F27C22',
        supportBubble: isDark ? '#2C2C34' : '#EAEEF3',
        accent: '#F27C22',
        navy: '#1F2050',
        headerBg: isDark ? '#1A1A22' : '#FFFFFF',
    };

    const handleSend = () => {
        if (!inputText.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText.trim(),
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        // Scroll to bottom
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // Simulate support response
        setTimeout(() => {
            setIsTyping(false);
            const supportMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Thank you for reaching out! Our support team has received your message and will respond shortly. Is there anything else you'd like to add?",
                sender: 'support',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, supportMessage]);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }, 2000);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isUser = item.sender === 'user';

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 50).springify()}
                style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowSupport,
                ]}
            >
                {!isUser && (
                    <View style={[styles.avatarSmall, { backgroundColor: `${colors.accent}15` }]}>
                        <Ionicons name="headset" size={16} color={colors.accent} />
                    </View>
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isUser
                            ? [styles.userBubble, { backgroundColor: colors.userBubble }]
                            : [styles.supportBubble, { backgroundColor: colors.supportBubble }],
                    ]}
                >
                    <ThemedText
                        style={[
                            styles.messageText,
                            { color: isUser ? '#FFFFFF' : colors.text },
                        ]}
                    >
                        {item.text}
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.messageTime,
                            { color: isUser ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                        ]}
                    >
                        {formatTime(item.timestamp)}
                    </ThemedText>
                </View>
            </Animated.View>
        );
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ThemedView style={[styles.container, { backgroundColor: colors.bg }]}>
                {/* Header */}
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 10 }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <View style={[styles.headerAvatar, { backgroundColor: `${colors.accent}15` }]}>
                            <Ionicons name="headset" size={24} color={colors.accent} />
                        </View>
                        <View style={styles.headerInfo}>
                            <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
                                Support Team
                            </ThemedText>
                            <View style={styles.onlineRow}>
                                <View style={styles.onlineDot} />
                                <ThemedText style={styles.onlineText}>Online • Usually responds instantly</ThemedText>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.menuButton}>
                        <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Chat Messages */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.chatContainer}
                    keyboardVerticalOffset={0}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.messagesList}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={() => (
                            <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.welcomeSection}>
                                <LottieView
                                    ref={lottieRef}
                                    source={{ uri: 'https://lottie.host/4e5cdb5e-31cc-4c38-b188-9b434c42e6f1/7i4VEgTJ0U.lottie' }}
                                    style={styles.lottieSmall}
                                    autoPlay
                                    loop
                                />
                                <View style={[styles.welcomeCard, { backgroundColor: colors.cardBg }]}>
                                    <ThemedText style={[styles.welcomeTitle, { color: colors.text }]}>
                                        Live Chat Support
                                    </ThemedText>
                                    <ThemedText style={[styles.welcomeText, { color: colors.textSecondary }]}>
                                        Get instant help from our dedicated support team
                                    </ThemedText>
                                </View>
                            </Animated.View>
                        )}
                        ListFooterComponent={() => (
                            isTyping ? (
                                <Animated.View entering={FadeIn} style={styles.typingRow}>
                                    <View style={[styles.avatarSmall, { backgroundColor: `${colors.accent}15` }]}>
                                        <Ionicons name="headset" size={16} color={colors.accent} />
                                    </View>
                                    <View style={[styles.typingBubble, { backgroundColor: colors.supportBubble }]}>
                                        <View style={styles.typingDots}>
                                            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                                            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                                            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                                        </View>
                                    </View>
                                </Animated.View>
                            ) : null
                        )}
                    />

                    {/* Input Area */}
                    <Animated.View
                        entering={FadeInUp.springify()}
                        style={[styles.inputContainer, { backgroundColor: colors.headerBg, paddingBottom: insets.bottom + 10 }]}
                    >
                        <View style={styles.inputRow}>
                            <TouchableOpacity style={styles.attachButton}>
                                <Ionicons name="attach" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TextInput
                                style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                                placeholder="Type a message..."
                                placeholderTextColor={colors.textMuted}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={1000}
                            />

                            <TouchableOpacity onPress={handleSend} disabled={!inputText.trim()}>
                                <LinearGradient
                                    colors={inputText.trim() ? [colors.accent, '#E86A10'] : [colors.textMuted, colors.textMuted]}
                                    style={styles.sendButton}
                                >
                                    <Ionicons name="send" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </ThemedView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    onlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
    },
    onlineText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '500',
    },
    menuButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Chat
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    lottieSmall: {
        width: 100,
        height: 100,
    },
    welcomeCard: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginTop: 8,
    },
    welcomeTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    welcomeText: {
        fontSize: 14,
        textAlign: 'center',
    },

    // Messages
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowSupport: {
        justifyContent: 'flex-start',
    },
    avatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 14,
        borderRadius: 20,
    },
    userBubble: {
        borderBottomRightRadius: 4,
    },
    supportBubble: {
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageTime: {
        fontSize: 11,
        marginTop: 6,
        textAlign: 'right',
    },

    // Typing indicator
    typingRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginTop: 8,
    },
    typingBubble: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        opacity: 0.6,
    },

    // Input
    inputContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    attachButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 15,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
