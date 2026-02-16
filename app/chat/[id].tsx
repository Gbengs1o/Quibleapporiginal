import GlitchLoader from '@/components/GlitchLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TypingIndicator from '@/components/TypingIndicator';
import { useAuth } from '@/contexts/auth';
import { useRiderNotifications } from '@/contexts/rider-notifications';
import { useThemeColor } from '@/hooks/use-theme-color';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatScreen() {
    const { id: chatId } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [chatPartner, setChatPartner] = useState<any>(null);

    // Media State
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [viewingMedia, setViewingMedia] = useState<any | null>(null);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);

    // Voice Preview State
    const [voicePreviewUri, setVoicePreviewUri] = useState<string | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);
    const durationInterval = useRef<NodeJS.Timeout | null>(null);

    // Options Menu State
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);

    // Animations
    const headerAnim = useRef(new Animated.Value(0)).current;
    const inputBarAnim = useRef(new Animated.Value(0)).current;

    // Theme
    const bgColor = useThemeColor({ light: '#F5F6FA', dark: '#0A0A0F' }, 'background');
    const cardBg = useThemeColor({ light: '#FFFFFF', dark: '#16161F' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const mutedText = useThemeColor({ light: '#6B7280', dark: '#9CA3AF' }, 'text');
    const isDark = bgColor === '#0A0A0F';
    const primary = '#F27C22';
    const navy = '#1F2050';
    const otherUserBubble = useThemeColor({ light: '#E8E9ED', dark: '#2A2A35' }, 'background');

    const { refreshNotifications } = useRiderNotifications();

    useEffect(() => {
        fetchChatDetails();
        fetchMessages();
        startEntranceAnimations();
        markAsRead();

        // 1. Listen for new messages
        const messageSub = supabase
            .channel(`chat:${chatId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                (payload) => {
                    const newMsg = payload.new;
                    setMessages(prev => [...prev, newMsg]);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

                    // If message is from other user, mark as read immediately since we are on the screen
                    if (newMsg.sender_id !== user?.id) {
                        markAsRead();
                    }
                }
            )
            .subscribe();

        // 2. Listen for typing status (Broadcast)
        const typingChannel = supabase.channel(`chat_typing:${chatId}`);
        typingChannel
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId !== user?.id) {
                    setOtherUserTyping(true);
                    if (typingTimeout.current) clearTimeout(typingTimeout.current);
                    typingTimeout.current = setTimeout(() => setOtherUserTyping(false), 3000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messageSub);
            supabase.removeChannel(typingChannel);
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            refreshNotifications(); // Refresh on exit just in case
        };
    }, [chatId]);

    const markAsRead = async () => {
        if (!user?.id) return;
        try {
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('chat_id', chatId)
                .neq('sender_id', user.id)
                .eq('is_read', false);

            // Refresh global badge
            refreshNotifications();
        } catch (e) {
            console.error("Error marking as read", e);
        }
    };

    const startEntranceAnimations = () => {
        Animated.parallel([
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.out(Easing.back(1.2)),
            }),
            Animated.timing(inputBarAnim, {
                toValue: 1,
                duration: 500,
                delay: 200,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }),
        ]).start();
    };

    const fetchChatDetails = async () => {
        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('*, rider:riders(*, profile:profiles(*)), customer:profiles(*)')
                .eq('id', chatId)
                .single();

            if (chat) {
                // Determine who the chat partner is
                const isCustomer = chat.customer_id === user?.id;
                if (isCustomer && chat.rider?.profile) {
                    setChatPartner({
                        name: `${chat.rider.profile.first_name} ${chat.rider.profile.last_name}`,
                        avatar: chat.rider.profile.profile_picture_url || chat.rider.rider_photo,
                        isOnline: chat.rider.is_online
                    });
                } else if (chat.customer) {
                    setChatPartner({
                        name: `${chat.customer.first_name} ${chat.customer.last_name}`,
                        avatar: chat.customer.profile_picture_url,
                        isOnline: true // Assume customer is online during chat
                    });
                }
            }
        } catch (e) {
            console.log('Error fetching chat details', e);
        }
    };

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputText = (text: string) => {
        setInputText(text);
        if (text.length > 0) {
            supabase.channel(`chat_typing:${chatId}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user?.id }
            });
        }
    };

    // --- Audio Logic ---
    async function startRecording() {
        try {
            if (permissionResponse?.status !== 'granted') {
                await requestPermission();
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    }

    async function stopRecording() {
        if (durationInterval.current) clearInterval(durationInterval.current);
        setRecording(null);
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
            // Show preview instead of auto-sending
            setVoicePreviewUri(uri);
        }
    }

    // Voice Preview Controls
    const playVoicePreview = async () => {
        if (!voicePreviewUri) return;
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }
            const { sound } = await Audio.Sound.createAsync({ uri: voicePreviewUri });
            soundRef.current = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlayingPreview(false);
                }
            });
            await sound.playAsync();
            setIsPlayingPreview(true);
        } catch (e) {
            console.error('Error playing preview', e);
        }
    };

    const pauseVoicePreview = async () => {
        if (soundRef.current) {
            await soundRef.current.pauseAsync();
            setIsPlayingPreview(false);
        }
    };

    const cancelVoicePreview = async () => {
        if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        setVoicePreviewUri(null);
        setRecordingDuration(0);
        setIsPlayingPreview(false);
    };

    const sendVoiceMessage = async () => {
        if (!voicePreviewUri) return;
        if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        setIsPlayingPreview(false);
        await sendMediaMessage(voicePreviewUri, 'audio');
        setVoicePreviewUri(null);
        setRecordingDuration(0);
    };

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Options Menu Actions
    const handleCallPartner = () => {
        setShowOptionsMenu(false);
        // Navigate to call or show phone
        Alert.alert('Call', `Would you like to call ${chatPartner?.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => console.log('Calling...') }
        ]);
    };

    const handleViewProfile = () => {
        setShowOptionsMenu(false);
        // Navigate to profile - determine if rider or customer
        router.push('/profile');
    };

    const handleClearChat = () => {
        setShowOptionsMenu(false);
        Alert.alert('Clear Chat', 'Are you sure you want to clear this chat?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) }
        ]);
    };

    // --- Image Logic ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) setSelectedImage(result.assets[0].uri);
    };

    const cancelImage = () => {
        setSelectedImage(null);
        setIsViewOnce(false);
    };

    // --- Send Logic ---
    const sendMediaMessage = async (uri: string, type: 'image' | 'audio') => {
        setSending(true);
        try {
            const cloudUrl = await uploadToCloudinary(uri, type);
            if (!cloudUrl) throw new Error("Upload failed");

            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user?.id,
                content: type === 'audio' ? '🎤 Voice Message' : (isViewOnce ? '📷 View Once Photo' : '📷 Photo'),
                media_url: cloudUrl,
                media_type: type,
                is_view_once: isViewOnce,
                is_viewed: false
            });
            if (error) throw error;

            await supabase.from('chats').update({
                last_message: type === 'audio' ? '🎤 Voice Message' : '📷 Photo',
                last_message_at: new Date()
            }).eq('id', chatId);

            setSelectedImage(null);
            setIsViewOnce(false);
        } catch (error) {
            Alert.alert("Error", "Failed to send message");
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const sendTextMessage = async () => {
        if (!inputText.trim() || sending) return;
        setSending(true);
        try {
            const content = inputText.trim();
            setInputText('');

            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user?.id,
                content: content,
                media_type: 'text'
            });
            if (error) throw error;

            await supabase.from('chats')
                .update({ last_message: content, last_message_at: new Date() })
                .eq('id', chatId);
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const handleViewMedia = async (message: any) => {
        if (message.is_view_once && !message.is_viewed && message.sender_id !== user?.id) {
            await supabase.from('messages').update({ is_viewed: true }).eq('id', message.id);
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_viewed: true } : m));
        }
        if (message.media_type === 'image') setViewingMedia(message);
    };

    const renderMessage = ({ item, index }: { item: any; index: number }) => {
        const isMe = item.sender_id === user?.id;
        const isViewOnce = item.is_view_once;
        const isViewed = item.is_viewed;

        // Check if we should show date separator
        const showDateSeparator = index === 0 ||
            new Date(item.created_at).toDateString() !== new Date(messages[index - 1]?.created_at).toDateString();

        return (
            <>
                {showDateSeparator && (
                    <View style={styles.dateSeparator}>
                        <View style={[styles.dateLine, { backgroundColor: mutedText + '30' }]} />
                        <ThemedText style={[styles.dateText, { color: mutedText }]}>
                            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </ThemedText>
                        <View style={[styles.dateLine, { backgroundColor: mutedText + '30' }]} />
                    </View>
                )}
                <Animated.View style={[
                    styles.messageRow,
                    isMe ? styles.myMessageRow : styles.otherMessageRow,
                ]}>
                    {/* Avatar for other user */}
                    {!isMe && (
                        <View style={styles.avatarContainer}>
                            {chatPartner?.avatar ? (
                                <Image source={{ uri: chatPartner.avatar }} style={styles.smallAvatar} />
                            ) : (
                                <View style={[styles.smallAvatar, { backgroundColor: navy + '30' }]}>
                                    <Ionicons name="person" size={14} color={navy} />
                                </View>
                            )}
                        </View>
                    )}

                    <View style={[
                        styles.messageBubble,
                        isMe ? styles.myBubble : [styles.otherBubble, { backgroundColor: otherUserBubble }],
                        item.media_type === 'image' && { padding: 4 }
                    ]}>
                        {/* Image Message */}
                        {item.media_type === 'image' && (
                            <TouchableOpacity
                                onPress={() => !(isViewOnce && isViewed && !isMe) && handleViewMedia(item)}
                                disabled={isViewOnce && isViewed && !isMe}
                                style={{ marginBottom: 4 }}
                            >
                                {isViewOnce ? (
                                    <LinearGradient
                                        colors={isMe ? [primary, '#E86A10'] : [navy, '#2D3066']}
                                        style={styles.viewOnceContainer}
                                    >
                                        <Ionicons name="eye-off" size={28} color="#fff" />
                                        <ThemedText style={styles.viewOnceText}>
                                            {isMe ? "View Once Photo" : (isViewed ? "Opened" : "Tap to view")}
                                        </ThemedText>
                                    </LinearGradient>
                                ) : (
                                    <Image
                                        source={{ uri: item.media_url }}
                                        style={styles.messageImage}
                                    />
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Audio Message */}
                        {item.media_type === 'audio' && (
                            <View style={styles.audioContainer}>
                                <TouchableOpacity style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : navy + '20' }]}>
                                    <Ionicons name="play" size={18} color={isMe ? "#fff" : navy} />
                                </TouchableOpacity>
                                <View style={styles.waveform}>
                                    {[...Array(12)].map((_, i) => (
                                        <View key={i} style={[
                                            styles.waveLine,
                                            { height: 8 + Math.random() * 14, backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : navy + '50' }
                                        ]} />
                                    ))}
                                </View>
                                <ThemedText style={[styles.audioDuration, { color: isMe ? 'rgba(255,255,255,0.7)' : mutedText }]}>
                                    0:12
                                </ThemedText>
                            </View>
                        )}

                        {/* Text Content */}
                        {item.content && item.media_type === 'text' && (
                            <ThemedText style={[styles.messageText, { color: isMe ? '#fff' : textColor }]}>
                                {item.content}
                            </ThemedText>
                        )}

                        {/* Timestamp */}
                        <View style={styles.timestampRow}>
                            <ThemedText style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.6)' : mutedText }]}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </ThemedText>
                            {isMe && (
                                <Ionicons
                                    name={isViewed ? "checkmark-done" : "checkmark"}
                                    size={14}
                                    color={isViewed ? "#4ADE80" : "rgba(255,255,255,0.5)"}
                                    style={{ marginLeft: 4 }}
                                />
                            )}
                        </View>
                    </View>
                </Animated.View>
            </>
        );
    };

    const renderEmptyChat = () => (
        <View style={styles.emptyContainer}>
            <GlitchLoader size={80} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                Start the Conversation
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: mutedText }]}>
                Send a message to get started
            </ThemedText>
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Hide the expo-router header */}
            <Stack.Screen options={{ headerShown: false }} />

            {/* Premium Header */}
            <Animated.View style={[
                styles.header,
                { backgroundColor: cardBg, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }
            ]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <View style={[styles.backBtnBg, { backgroundColor: isDark ? '#ffffff10' : navy + '10' }]}>
                        <Ionicons name="chevron-back" size={22} color={textColor} />
                    </View>
                </TouchableOpacity>

                {/* Chat Partner Info */}
                <View style={styles.headerCenter}>
                    {chatPartner?.avatar ? (
                        <Image source={{ uri: chatPartner.avatar }} style={styles.headerAvatar} />
                    ) : (
                        <View style={[styles.headerAvatar, { backgroundColor: primary + '20' }]}>
                            <Ionicons name="person" size={20} color={primary} />
                        </View>
                    )}
                    <View style={styles.headerInfo}>
                        <ThemedText style={[styles.headerName, { color: textColor }]} numberOfLines={1}>
                            {chatPartner?.name || 'Chat'}
                        </ThemedText>
                        {chatPartner?.isOnline && (
                            <View style={styles.onlineStatus}>
                                <View style={styles.onlineDot} />
                                <ThemedText style={[styles.onlineText, { color: '#22C55E' }]}>Online</ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOptionsMenu(true)}>
                    <Ionicons name="ellipsis-vertical" size={20} color={textColor} />
                </TouchableOpacity>
            </Animated.View>

            {/* Messages */}
            {loading ? (
                <View style={styles.centerContent}>
                    <GlitchLoader size={100} />
                    <ThemedText style={[styles.loadingText, { color: mutedText }]}>Loading messages...</ThemedText>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1 }]}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListEmptyComponent={renderEmptyChat}
                    ListFooterComponent={otherUserTyping ? <TypingIndicator /> : null}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Image Preview Overlay */}
            {selectedImage && (
                <View style={[styles.imagePreviewContainer, { backgroundColor: '#000' }]}>
                    <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
                    <View style={styles.previewControls}>
                        <TouchableOpacity onPress={cancelImage} style={styles.cancelPreviewBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsViewOnce(!isViewOnce)}
                            style={[styles.viewOnceToggle, isViewOnce && { backgroundColor: primary }]}
                        >
                            <Ionicons name={isViewOnce ? "eye-off" : "eye"} size={20} color="#fff" />
                            <ThemedText style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6 }}>
                                {isViewOnce ? 'View Once' : 'Normal'}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => sendMediaMessage(selectedImage, 'image')} style={[styles.sendPreviewBtn, { backgroundColor: primary }]}>
                            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={24} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Voice Preview Bar */}
            {voicePreviewUri && (
                <View style={[styles.voicePreviewBar, { backgroundColor: cardBg }]}>
                    <TouchableOpacity onPress={cancelVoicePreview} style={styles.voiceCancelBtn}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>

                    <View style={styles.voicePreviewCenter}>
                        <TouchableOpacity
                            onPress={isPlayingPreview ? pauseVoicePreview : playVoicePreview}
                            style={[styles.voicePlayBtn, { backgroundColor: primary }]}
                        >
                            <Ionicons name={isPlayingPreview ? "pause" : "play"} size={22} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.voiceWaveform}>
                            {[...Array(20)].map((_, i) => (
                                <View key={i} style={[
                                    styles.voiceWaveLine,
                                    { height: 6 + Math.sin(i * 0.5) * 12, backgroundColor: primary + '60' }
                                ]} />
                            ))}
                        </View>

                        <ThemedText style={[styles.voiceDuration, { color: textColor }]}>
                            {formatDuration(recordingDuration)}
                        </ThemedText>
                    </View>

                    <TouchableOpacity
                        onPress={sendVoiceMessage}
                        style={[styles.voiceSendBtn, { backgroundColor: primary }]}
                        disabled={sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Input Bar */}
            {!selectedImage && !voicePreviewUri && (
                <Animated.View style={[
                    styles.inputWrapper,
                    { backgroundColor: cardBg, opacity: inputBarAnim, transform: [{ translateY: inputBarAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }
                ]}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}>
                        <View style={styles.inputContainer}>
                            {/* Camera Button */}
                            <TouchableOpacity onPress={pickImage} style={[styles.actionBtn, { backgroundColor: primary + '15' }]}>
                                <Ionicons name="camera" size={22} color={primary} />
                            </TouchableOpacity>

                            {/* Text Input */}
                            <View style={[styles.inputBox, { backgroundColor: bgColor, borderColor: isDark ? '#333' : '#E5E7EB' }]}>
                                <TextInput
                                    style={[styles.input, { color: textColor }]}
                                    placeholder="Type a message..."
                                    placeholderTextColor={mutedText}
                                    value={inputText}
                                    onChangeText={handleInputText}
                                    multiline
                                />
                                <TouchableOpacity style={styles.emojiBtn}>
                                    <Ionicons name="happy-outline" size={22} color={mutedText} />
                                </TouchableOpacity>
                            </View>

                            {/* Send / Record Button */}
                            {inputText.trim() ? (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: primary }]}
                                    onPress={sendTextMessage}
                                    disabled={sending}
                                >
                                    {sending ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="send" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.sendBtn, { backgroundColor: recording ? '#EF4444' : navy }]}
                                    onPress={recording ? stopRecording : startRecording}
                                >
                                    <Ionicons name={recording ? "stop" : "mic"} size={20} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Recording Indicator */}
                        {recording && (
                            <View style={styles.recordingBar}>
                                <View style={styles.recordingDot} />
                                <ThemedText style={styles.recordingText}>Recording... Tap to send</ThemedText>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </Animated.View>
            )}

            {/* Full Screen Image Modal */}
            <Modal visible={!!viewingMedia} transparent animationType="fade" onRequestClose={() => setViewingMedia(null)}>
                <View style={styles.mediaModal}>
                    <TouchableOpacity style={styles.closeMediaBtn} onPress={() => setViewingMedia(null)}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {viewingMedia && (
                        <Image source={{ uri: viewingMedia.media_url }} style={styles.fullImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>

            {/* Options Menu Modal */}
            <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
                <TouchableOpacity
                    style={styles.optionsOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptionsMenu(false)}
                >
                    <View style={[styles.optionsMenu, { backgroundColor: cardBg }]}>
                        <ThemedText style={[styles.optionsTitle, { color: textColor }]}>Options</ThemedText>

                        <TouchableOpacity style={styles.optionItem} onPress={handleCallPartner}>
                            <View style={[styles.optionIcon, { backgroundColor: '#22C55E20' }]}>
                                <Ionicons name="call" size={20} color="#22C55E" />
                            </View>
                            <ThemedText style={[styles.optionText, { color: textColor }]}>Call {chatPartner?.name?.split(' ')[0] || 'Partner'}</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} onPress={handleViewProfile}>
                            <View style={[styles.optionIcon, { backgroundColor: primary + '20' }]}>
                                <Ionicons name="person" size={20} color={primary} />
                            </View>
                            <ThemedText style={[styles.optionText, { color: textColor }]}>View Profile</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} onPress={handleClearChat}>
                            <View style={[styles.optionIcon, { backgroundColor: '#EF444420' }]}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </View>
                            <ThemedText style={[styles.optionText, { color: '#EF4444' }]}>Clear Chat</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionItem, styles.optionCancel]}
                            onPress={() => setShowOptionsMenu(false)}
                        >
                            <ThemedText style={[styles.optionText, { color: mutedText }]}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { fontSize: 14, marginTop: 12 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backBtn: { marginRight: 8 },
    backBtnBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    headerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerInfo: { marginLeft: 12, flex: 1 },
    headerName: { fontSize: 16, fontWeight: '700' },
    onlineStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
    onlineText: { fontSize: 12, fontWeight: '500' },
    moreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

    // Messages
    listContent: { padding: 16, paddingBottom: 8 },
    messageRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end' },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },
    avatarContainer: { marginRight: 8 },
    smallAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

    messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 20 },
    myBubble: { backgroundColor: '#F27C22', borderBottomRightRadius: 6 },
    otherBubble: { borderBottomLeftRadius: 6 },
    messageText: { fontSize: 15, lineHeight: 21 },
    messageTime: { fontSize: 10 },
    timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
    messageImage: { width: 200, height: 200, borderRadius: 16 },

    // Date Separator
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 20 },
    dateLine: { flex: 1, height: 1 },
    dateText: { fontSize: 12, marginHorizontal: 12, fontWeight: '500' },

    // View Once
    viewOnceContainer: { width: 200, height: 200, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    viewOnceText: { color: '#fff', marginTop: 8, fontWeight: '600', fontSize: 13 },

    // Audio
    audioContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, width: 180 },
    playBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    waveform: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, gap: 2 },
    waveLine: { width: 3, borderRadius: 2 },
    audioDuration: { fontSize: 11 },

    // Empty State
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
    emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 24 },
    emptySubtitle: { fontSize: 14, marginTop: 8 },

    // Input Bar
    inputWrapper: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    inputContainer: { flexDirection: 'row', padding: 12, alignItems: 'flex-end', gap: 10 },
    actionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, minHeight: 48 },
    input: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 12 },
    emojiBtn: { padding: 4 },
    sendBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

    // Recording
    recordingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', padding: 10 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 8 },
    recordingText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    // Preview
    imagePreviewContainer: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
    previewImage: { width: '100%', height: '75%' },
    previewControls: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 20 },
    cancelPreviewBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    sendPreviewBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    viewOnceToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25 },

    // Modal
    mediaModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
    closeMediaBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },

    // Voice Preview Bar
    voicePreviewBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    voiceCancelBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EF444420' },
    voicePreviewCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
    voicePlayBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    voiceWaveform: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, gap: 2 },
    voiceWaveLine: { width: 3, borderRadius: 2 },
    voiceDuration: { fontSize: 13, fontWeight: '600', minWidth: 40 },
    voiceSendBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

    // Options Menu
    optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    optionsMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
    optionsTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    optionText: { fontSize: 16, fontWeight: '500' },
    optionCancel: { justifyContent: 'center', marginTop: 10, borderBottomWidth: 0 },
});
