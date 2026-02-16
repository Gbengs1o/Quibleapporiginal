import GlitchLoader from '@/components/GlitchLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TypingIndicator from '@/components/TypingIndicator';
import { useAuth } from '@/contexts/auth';
import { useCall } from '@/contexts/call-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function OrderChatScreen() {
    const { id: chatId, target } = useLocalSearchParams<{ id: string, target?: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { startCall } = useCall();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const [chatDetails, setChatDetails] = useState<any>(null);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [customer, setCustomer] = useState<any>(null);
    const [rider, setRider] = useState<any>(null);
    const [restaurantOwner, setRestaurantOwner] = useState<any>(null);

    // Media State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);

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

    useEffect(() => {
        if (chatId) {
            fetchChatDetails();
            fetchMessages();
            startEntranceAnimations();

            // Real-time subscription
            const messageSub = supabase
                .channel(`order_chat:${chatId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'order_chat_messages',
                    filter: `chat_id=eq.${chatId}`
                },
                    (payload) => {
                        setMessages(prev => {
                            const exists = prev.some(m => m.id === payload.new.id);
                            if (exists) {
                                return prev.map(m => m.id === payload.new.id ? payload.new : m);
                            }
                            return [...prev, payload.new];
                        });
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    }
                )
                .subscribe();

            // Typing indicator
            const typingChannel = supabase.channel(`order_typing:${chatId}`);
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
            };
        }
    }, [chatId]);

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
                .from('order_chats')
                .select('*, restaurant:restaurants(*), order:orders(*)')
                .eq('id', chatId)
                .single();

            if (chat) {
                setChatDetails(chat);
                setRestaurant(chat.restaurant);

                // Fetch customer profile
                if (chat.customer_id) {
                    const { data: customerData } = await supabase
                        .from('profiles')
                        .select('first_name, last_name, profile_picture_url, phone_number')
                        .eq('id', chat.customer_id)
                        .single();
                    setCustomer(customerData);
                }

                // Fetch restaurant owner profile
                if (chat.restaurant?.owner_id) {
                    const { data: ownerData } = await supabase
                        .from('profiles')
                        .select('id, phone_number, first_name, last_name')
                        .eq('id', chat.restaurant.owner_id)
                        .single();
                    setRestaurantOwner(ownerData);
                }

                // Fetch rider profile (via order or direct id if available)
                const riderId = chat.order?.rider_id;
                if (riderId) {
                    const { data: riderData } = await supabase
                        .from('profiles')
                        .select('first_name, last_name, profile_picture_url, phone_number')
                        .eq('id', riderId)
                        .single();
                    setRider(riderData);
                }

                // Mark unread messages as read
                markMessagesAsRead(chat.id);
            }
        } catch (e) {
            console.log('Error fetching chat details', e);
        }
    };

    const markMessagesAsRead = async (currentChatId: string) => {
        try {
            await supabase
                .from('order_chat_messages')
                .update({ is_read: true })
                .eq('chat_id', currentChatId)
                .eq('is_read', false)
                .neq('sender_id', user?.id);
        } catch (e) {
            console.log('Error marking messages as read', e);
        }
    };

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('order_chat_messages')
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
            supabase.channel(`order_typing:${chatId}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user?.id }
            });
        }
    };

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
    };

    const sendMediaMessage = async (uri: string) => {
        setSending(true);
        try {
            const cloudUrl = await uploadToCloudinary(uri, 'image');
            if (!cloudUrl) throw new Error("Upload failed");

            const { data, error } = await supabase.from('order_chat_messages').insert({
                chat_id: chatId,
                sender_id: user?.id,
                content: '📷 Photo',
                media_url: cloudUrl,
                media_type: 'image',
            }).select().single();
            if (error) throw error;

            if (data) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === data.id);
                    return exists ? prev : [...prev, data];
                });
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }

            await supabase.from('order_chats').update({
                last_message: '📷 Photo',
                last_message_at: new Date()
            }).eq('id', chatId);

            setSelectedImage(null);
        } catch (error) {
            Alert.alert("Error", "Failed to send image");
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

            const { data, error } = await supabase.from('order_chat_messages').insert({
                chat_id: chatId,
                sender_id: user?.id,
                content: content,
                media_type: 'text'
            }).select().single();
            if (error) throw error;

            if (data) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === data.id);
                    return exists ? prev : [...prev, data];
                });
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }

            await supabase.from('order_chats')
                .update({ last_message: content, last_message_at: new Date() })
                .eq('id', chatId);
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    // Determine if current user is the restaurant owner
    const isRestaurantOwner = user?.id === chatDetails?.restaurant?.owner_id;
    const isRider = user?.id === chatDetails?.order?.rider_id;

    // Context-aware: who is the "other party" for this user?
    const getOtherPartyInfo = () => {
        // If target is explicitly set, prioritize that
        if (target === 'customer' || target === 'user') {
            return {
                id: chatDetails?.customer_id,
                name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer',
                avatar: customer?.profile_picture_url,
                subtitle: 'Customer',
                phone: customer?.phone_number,
                icon: 'person' as const,
            };
        }

        if (target === 'restaurant') {
            return {
                id: restaurantOwner?.id || chatDetails?.restaurant?.owner_id,
                name: restaurant?.name || 'Restaurant',
                avatar: restaurant?.image_url || restaurant?.logo_url,
                subtitle: 'Restaurant',
                phone: restaurant?.phone || restaurantOwner?.phone_number,
                icon: 'restaurant' as const,
            };
        }

        if (isRestaurantOwner) {
            // Restaurant Owner interacting with Customer or Rider
            if (chatDetails?.chat_type === 'rider_restaurant') {
                return {
                    id: chatDetails?.order?.rider_id,
                    name: rider ? `${rider.first_name || ''} ${rider.last_name || ''}`.trim() : 'Rider',
                    avatar: rider?.profile_picture_url,
                    subtitle: 'Delivery Partner',
                    phone: rider?.phone_number,
                    icon: 'bicycle' as const,
                };
            } else {
                // Default to Customer
                return {
                    id: chatDetails?.customer_id,
                    name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer',
                    avatar: customer?.profile_picture_url,
                    subtitle: 'Customer',
                    phone: customer?.phone_number,
                    icon: 'person' as const,
                };
            }
        } else if (isRider) {
            // Rider perspective
            if (chatDetails?.chat_type === 'rider_customer') {
                return {
                    id: chatDetails?.customer_id,
                    name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer',
                    avatar: customer?.profile_picture_url,
                    subtitle: 'Customer',
                    phone: customer?.phone_number,
                    icon: 'person' as const,
                };
            } else {
                // Default to Restaurant (rider_restaurant or fallback)
                return {
                    id: restaurantOwner?.id || chatDetails?.restaurant?.owner_id,
                    name: restaurant?.name || 'Restaurant',
                    avatar: restaurant?.image_url || restaurant?.logo_url,
                    subtitle: 'Restaurant',
                    phone: restaurant?.phone || restaurantOwner?.phone_number,
                    icon: 'restaurant' as const,
                };
            }
        } else {
            // Customer perspective
            if (chatDetails?.chat_type === 'rider_customer') {
                return {
                    id: chatDetails?.order?.rider_id,
                    name: rider ? `${rider.first_name || ''} ${rider.last_name || ''}`.trim() : 'Rider',
                    avatar: rider?.profile_picture_url,
                    subtitle: 'Delivery Partner',
                    phone: rider?.phone_number,
                    icon: 'bicycle' as const,
                };
            } else {
                // Default to Restaurant
                return {
                    id: restaurantOwner?.id || chatDetails?.restaurant?.owner_id,
                    name: restaurant?.name || 'Restaurant',
                    avatar: restaurant?.image_url || restaurant?.logo_url,
                    subtitle: 'Order Support',
                    phone: restaurant?.phone || restaurantOwner?.phone_number,
                    icon: 'restaurant' as const,
                };
            }
        }
    };

    const otherParty = getOtherPartyInfo();

    const handlePhoneCall = () => {
        const phone = otherParty.phone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', `${otherParty.name}'s phone number is not available`);
        }
    };

    const handleInAppCall = () => {
        if (otherParty.id) {
            startCall(otherParty.id);
        } else {
            Alert.alert('Unavailable', 'Cannot initiate in-app call for this user.');
        }
    };

    const getSenderInfo = (senderId: string) => {
        if (customer && senderId === customer.id) return { name: customer.first_name || 'Customer', avatar: customer.profile_picture_url, role: 'customer' };
        if (restaurantOwner && senderId === restaurantOwner.id) return { name: restaurant?.name || 'Restaurant', avatar: restaurant?.image_url || restaurant?.logo_url, role: 'restaurant' };
        if (rider && senderId === rider.id) return { name: rider.first_name || 'Rider', avatar: rider.profile_picture_url, role: 'rider' };
        return { name: 'User', avatar: null, role: 'customer' };
    };

    const renderMessage = ({ item, index }: { item: any; index: number }) => {
        const isMe = item.sender_id === user?.id;
        const senderInfo = !isMe ? getSenderInfo(item.sender_id) : null;

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
                <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                    {!isMe && (
                        <View style={styles.avatarContainer}>
                            {senderInfo?.avatar ? (
                                <Image source={{ uri: senderInfo.avatar }} style={styles.smallAvatar} />
                            ) : (
                                <View style={[styles.smallAvatar, { backgroundColor: senderInfo?.role === 'restaurant' ? primary + '30' : '#E5E7EB' }]}>
                                    <Ionicons
                                        name={senderInfo?.role === 'restaurant' ? 'restaurant' : senderInfo?.role === 'rider' ? 'bicycle' : 'person'}
                                        size={12}
                                        color={senderInfo?.role === 'restaurant' ? primary : '#6B7280'}
                                    />
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ maxWidth: '75%' }}>
                        {!isMe && senderInfo && (
                            <ThemedText style={{ fontSize: 10, color: mutedText, marginBottom: 2, marginLeft: 4 }}>
                                {senderInfo.name}
                            </ThemedText>
                        )}
                        <View style={[
                            styles.messageBubble,
                            isMe ? styles.myBubble : [styles.otherBubble, { backgroundColor: otherUserBubble }],
                            item.media_type === 'image' && { padding: 4 }
                        ]}>
                            {item.media_type === 'image' && item.media_url && (
                                <Image source={{ uri: item.media_url }} style={styles.messageImage} />
                            )}

                            {item.media_type === 'text' && (
                                <ThemedText style={[styles.messageText, { color: isMe ? '#fff' : textColor }]}>
                                    {item.content}
                                </ThemedText>
                            )}

                            <View style={styles.timestampRow}>
                                <ThemedText style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.6)' : mutedText }]}>
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </ThemedText>
                                {isMe && (
                                    <Ionicons
                                        name={item.is_read ? "checkmark-done" : "checkmark"}
                                        size={14}
                                        color={item.is_read ? "#4ADE80" : "rgba(255,255,255,0.5)"}
                                        style={{ marginLeft: 4 }}
                                    />
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </>
        );
    };

    const renderEmptyChat = () => (
        <View style={styles.emptyContainer}>
            <GlitchLoader size={80} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                {isRestaurantOwner ? 'Chat with Customer' : 'Chat with Restaurant'}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: mutedText }]}>
                {isRestaurantOwner
                    ? 'Respond to customer questions about their order'
                    : 'Ask about your order or special requests'}
            </ThemedText>
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <Animated.View style={[
                styles.header,
                { backgroundColor: cardBg, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }
            ]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <View style={[styles.backBtnBg, { backgroundColor: isDark ? '#ffffff10' : navy + '10' }]}>
                        <Ionicons name="chevron-back" size={22} color={textColor} />
                    </View>
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    {otherParty.avatar ? (
                        <Image source={{ uri: otherParty.avatar }} style={styles.headerAvatar} />
                    ) : (
                        <LinearGradient colors={[primary, '#E86A10']} style={styles.headerAvatar}>
                            <Ionicons name={otherParty.icon} size={18} color="#fff" />
                        </LinearGradient>
                    )}
                    <View style={styles.headerInfo}>
                        <ThemedText style={[styles.headerName, { color: textColor }]} numberOfLines={1}>
                            {otherParty.name}
                        </ThemedText>
                        <ThemedText style={[styles.headerSubtext, { color: mutedText }]}>
                            {otherParty.subtitle}
                        </ThemedText>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#F27C2220' }]} onPress={handlePhoneCall}>
                        <Ionicons name="keypad" size={18} color="#F27C22" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#22C55E20' }]} onPress={handleInAppCall}>
                        <Ionicons name="call" size={18} color="#22C55E" />
                    </TouchableOpacity>
                </View>
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

            {/* Image Preview */}
            {selectedImage && (
                <View style={[styles.imagePreviewContainer, { backgroundColor: '#000' }]}>
                    <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
                    <View style={styles.previewControls}>
                        <TouchableOpacity onPress={cancelImage} style={styles.cancelPreviewBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => sendMediaMessage(selectedImage)} style={[styles.sendPreviewBtn, { backgroundColor: primary }]}>
                            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={24} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Input Bar */}
            {!selectedImage && (
                <Animated.View style={[
                    styles.inputWrapper,
                    { backgroundColor: cardBg, opacity: inputBarAnim, transform: [{ translateY: inputBarAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }
                ]}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}>
                        <View style={styles.inputContainer}>
                            <TouchableOpacity onPress={pickImage} style={[styles.actionBtn, { backgroundColor: primary + '15' }]}>
                                <Ionicons name="camera" size={22} color={primary} />
                            </TouchableOpacity>

                            <View style={[styles.inputBox, { backgroundColor: bgColor, borderColor: isDark ? '#333' : '#E5E7EB' }]}>
                                <TextInput
                                    style={[styles.input, { color: textColor }]}
                                    placeholder="Type a message..."
                                    placeholderTextColor={mutedText}
                                    value={inputText}
                                    onChangeText={handleInputText}
                                    multiline
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.sendBtn, { backgroundColor: inputText.trim() ? primary : navy }]}
                                onPress={sendTextMessage}
                                disabled={!inputText.trim() || sending}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="send" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Animated.View>
            )}
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
    headerSubtext: { fontSize: 12 },
    callBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

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

    // Date separator
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 20 },
    dateLine: { flex: 1, height: 1 },
    dateText: { marginHorizontal: 12, fontSize: 12 },

    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 24 },
    emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },

    // Image Preview
    imagePreviewContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    previewImage: { width: '100%', height: '70%' },
    previewControls: { position: 'absolute', bottom: 50, flexDirection: 'row', gap: 20 },
    cancelPreviewBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    sendPreviewBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },

    // Input
    inputWrapper: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    actionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, minHeight: 44, maxHeight: 100 },
    input: { flex: 1, fontSize: 15, paddingVertical: 10 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
