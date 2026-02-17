import { supabase } from '@/utils/supabase';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth';

interface RiderNotificationsContextType {
    unreadMessages: number;
    pendingDeliveries: number;
    pendingFoodInvites: number;
    unreadAlerts: number;
    refreshNotifications: () => Promise<void>;
}

const RiderNotificationsContext = createContext<RiderNotificationsContextType>({
    unreadMessages: 0,
    pendingDeliveries: 0,
    pendingFoodInvites: 0,
    unreadAlerts: 0,
    refreshNotifications: async () => { },
});

export const RiderNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const { session } = useAuth();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [pendingDeliveries, setPendingDeliveries] = useState(0);
    const [pendingFoodInvites, setPendingFoodInvites] = useState(0);
    const [unreadAlerts, setUnreadAlerts] = useState(0);

    const refreshNotifications = useCallback(async () => {
        if (!session?.user.id) return;

        try {
            // 1. Unread Messages (Chats & Order Chats)
            const [personalChatsRes, orderChatsRes] = await Promise.all([
                supabase.from('chats').select('id').eq('rider_id', session.user.id),
                supabase.from('orders').select('id').eq('rider_id', session.user.id)
            ]);

            const personalChatIds = personalChatsRes.data?.map(c => c.id) || [];

            // For order chats, we need to find chats linked to these orders
            let orderChatIds: string[] = [];
            if (orderChatsRes.data && orderChatsRes.data.length > 0) {
                const orderIds = orderChatsRes.data.map(o => o.id);
                const { data: oc } = await supabase
                    .from('order_chats')
                    .select('id')
                    .in('order_id', orderIds);
                orderChatIds = oc?.map(c => c.id) || [];
            }

            const allChatIds = [...personalChatIds, ...orderChatIds];

            if (allChatIds.length > 0) {
                const { count: unreadCount } = await supabase
                    .from('order_chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .in('chat_id', allChatIds)
                    .eq('is_read', false)
                    .neq('sender_id', session.user.id);

                // Also check legacy messages table if necessary, but most likely riders use order_chat_messages
                const { count: legacyUnreadCount } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .in('chat_id', allChatIds)
                    .eq('is_read', false)
                    .neq('sender_id', session.user.id);

                setUnreadMessages((unreadCount || 0) + (legacyUnreadCount || 0));
            } else {
                setUnreadMessages(0);
            }

            // 2. Pending Deliveries (Logistics)
            const { count: delCount } = await supabase
                .from('delivery_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingDeliveries(delCount || 0);

            // 3. Pending Food Invites (from restaurants)
            const { count: foodInviteCount } = await supabase
                .from('order_rider_bids')
                .select('*', { count: 'exact', head: true })
                .eq('rider_id', session.user.id)
                .eq('status', 'invited');
            setPendingFoodInvites(foodInviteCount || 0);

            // 4. Unread Alerts (Notifications table)
            const { count: notifCount } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .eq('is_read', false);
            setUnreadAlerts(notifCount || 0);

        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [session?.user.id]);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!session?.user.id) return;

        refreshNotifications();

        const channel = supabase.channel('rider-global-notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_rider_bids' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_chats' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_chat_messages' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshNotifications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refreshNotifications())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user.id, refreshNotifications]);

    return (
        <RiderNotificationsContext.Provider value={{
            unreadMessages,
            pendingDeliveries,
            pendingFoodInvites,
            unreadAlerts,
            refreshNotifications
        }}>
            {children}
        </RiderNotificationsContext.Provider>
    );
};

export const useRiderNotifications = () => useContext(RiderNotificationsContext);
