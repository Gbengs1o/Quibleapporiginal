import { supabase } from '@/utils/supabase';
import { Audio } from 'expo-av';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth';

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'with_rider' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OrderItem {
    id: string;
    order_id: string;
    menu_item_id: string;
    quantity: number;
    price_at_time: number;
    options: string;
    menu_item: {
        id: string;
        name: string;
        price: number;
        image_url?: string;
    };
}

export interface Order {
    id: string;
    user_id: string;
    restaurant_id: string;
    total_amount: number;
    status: OrderStatus;
    delivery_code?: string;
    created_at: string;
    updated_at: string;
    restaurant: {
        id: string;
        name: string;
        image_url: string | null;
        address: string;
    };
    items: OrderItem[];
    rider?: {
        id: string;
        user_id: string;
        rider_photo: string | null;
        vehicle_type?: string;
        vehicle_plate?: string;
        profile: {
            first_name: string;
            last_name: string;
            phone_number: string;
            profile_picture_url: string | null;
        }
    } | null;
}

interface OrderContextType {
    activeOrders: Order[];
    pastOrders: Order[];
    restaurantOrders: Order[];
    loading: boolean;
    refreshOrders: () => Promise<void>;
    updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
    placeOrder: (
        restaurantId: string,
        totalAmount: number,
        items: { menu_item_id: string; quantity: number; price: number; options?: string }[],
        location?: {
            pickup_lat?: number;
            pickup_lng?: number;
            dropoff_lat?: number;
            dropoff_lng?: number;
        }
    ) => Promise<string>;
    cancelOrder: (orderId: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [pastOrders, setPastOrders] = useState<Order[]>([]);
    const [restaurantOrders, setRestaurantOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            refreshOrders();
            // Subscribe to real-time changes
            const channel = supabase
                .channel('orders_channel')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'orders' },
                    (payload) => {
                        // Simple refresh strategy for now to keep it synced
                        refreshOrders();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    const refreshOrders = async () => {
        setLoading(true);
        try {
            // 1. Fetch User Orders (Active)
            const { data: userOrdersData } = await supabase
                .from('orders')
                .select('*, restaurant:restaurants(*), items:order_items(*, menu_item:menu_items(*)), rider:riders(*, profile:profiles(*))')
                .eq('user_id', user?.id)
                .in('status', ['received', 'preparing', 'ready', 'with_rider', 'out_for_delivery'])
                .order('created_at', { ascending: false });

            if (userOrdersData) setActiveOrders(userOrdersData as any);

            // 2. Fetch User Orders (Past)
            const { data: pastOrdersData } = await supabase
                .from('orders')
                .select('*, restaurant:restaurants(*), items:order_items(*, menu_item:menu_items(*)), rider:riders(*, profile:profiles(*))')
                .eq('user_id', user?.id)
                .in('status', ['delivered', 'cancelled'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (pastOrdersData) setPastOrders(pastOrdersData as any);

            // 3. Fetch Restaurant Orders (If user is an owner)
            // Ideally we check if they have a restaurant first
            const { data: restOrdersData } = await supabase
                .from('orders')
                .select('*, items:order_items(*, menu_item:menu_items(*)), rider:riders(*, profile:profiles(*))')
                // This relies on the RLS policy "Owners can view restaurant orders"
                // We filter by client side or rely on RLS returning only what they own. 
                // However, 'select' without filter fetches all rows visible to user.
                // Since RLS is set, this is safe.
                .not('status', 'eq', 'cancelled') // Maybe filter cancelled?
                .order('created_at', { ascending: false });

            if (restOrdersData) setRestaurantOrders(restOrdersData as any);

        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
        try {
            await supabase
                .from('orders')
                .update({ status })
                .eq('id', orderId);
            refreshOrders();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const placeOrder = async (
        restaurantId: string,
        totalAmount: number,
        items: { menu_item_id: string; quantity: number; price: number; options?: string }[],
        location?: {
            pickup_lat?: number;
            pickup_lng?: number;
            dropoff_lat?: number;
            dropoff_lng?: number;
        }
    ) => {
        const { data, error } = await supabase.rpc('place_order', {
            p_restaurant_id: restaurantId,
            p_total_amount: totalAmount,
            p_items: items,
            p_pickup_lat: location?.pickup_lat,
            p_pickup_lng: location?.pickup_lng,
            p_dropoff_lat: location?.dropoff_lat,
            p_dropoff_lng: location?.dropoff_lng
        });

        if (error) throw error;
        if (data && !data.success) throw new Error(data.message);

        // Refresh to show new order immediately
        refreshOrders();
        return data.order_id;
    };

    const cancelOrder = async (orderId: string) => {
        const { data, error } = await supabase.rpc('cancel_order_refund', {
            p_order_id: orderId
        });

        if (error) throw error;
        if (data && !data.success) throw new Error(data.message);

        refreshOrders();
    };

    const playNotificationSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/sounds/notification.mp3') // We'll need to check if asset exists or use default
            );
            await sound.playAsync();
        } catch (error) {
            // Fallback if custom sound fails or missing
            console.log("Sound error or missing asset");
        }
    };

    return (
        <OrderContext.Provider value={{ activeOrders, pastOrders, restaurantOrders, loading, refreshOrders, updateOrderStatus, placeOrder, cancelOrder }}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (context === undefined) {
        throw new Error('useOrders must be used within an OrderProvider');
    }
    return context;
}
