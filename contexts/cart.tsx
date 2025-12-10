import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CartItem {
    id: string;
    dishId: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    image_url: string | null;
    restaurant: {
        id: string;
        name: string;
        logo_url: string | null;
    };
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
    removeFromCart: (id: string) => void;
    removeByDishId: (dishId: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    getItemCount: () => number;
    getTotal: () => number;
    isInCart: (dishId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = '@quible_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);

    // Load cart from storage on mount
    useEffect(() => {
        loadCart();
    }, []);

    // Save cart to storage whenever it changes
    useEffect(() => {
        saveCart();
    }, [items]);

    // Listen for dish changes and remove inactive dishes from cart
    useEffect(() => {
        const channel = supabase
            .channel('cart_dish_updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'menu_items' },
                (payload: any) => {
                    const updatedDish = payload.new as any;

                    // If dish becomes inactive, remove it from cart silently
                    if (!updatedDish.is_active) {
                        setItems(prev => prev.filter(item => item.dishId !== updatedDish.id));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'menu_items' },
                (payload: any) => {
                    const deletedDish = payload.old as any;
                    // Remove deleted dish from cart
                    setItems(prev => prev.filter(item => item.dishId !== deletedDish.id));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadCart = async () => {
        try {
            const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
            if (stored) {
                const parsedItems = JSON.parse(stored);
                // Self-healing: Remove items with missing dishId (from previous bug)
                const validItems = parsedItems.filter((i: any) => i.dishId && i.restaurant);
                setItems(validItems);
            }
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    };

    const saveCart = async () => {
        try {
            await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    };

    const addToCart = (item: Omit<CartItem, 'id' | 'quantity'>) => {
        const existingItem = items.find(i => i.dishId === item.dishId);

        if (existingItem) {
            setItems(items.map(i =>
                i.dishId === item.dishId
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
            ));
        } else {
            setItems([...items, {
                ...item,
                id: `${item.dishId}-${Date.now()}`,
                quantity: 1,
            }]);
        }
    };

    const removeFromCart = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const removeByDishId = (dishId: string) => {
        setItems(items.filter(item => item.dishId !== dishId));
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(id);
        } else {
            setItems(items.map(item =>
                item.id === id ? { ...item, quantity } : item
            ));
        }
    };

    const clearCart = () => {
        setItems([]);
    };

    const getItemCount = () => {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    };

    const getTotal = () => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const isInCart = (dishId: string) => {
        return items.some(item => item.dishId === dishId);
    };

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            removeByDishId,
            updateQuantity,
            clearCart,
            getItemCount,
            getTotal,
            isInCart,
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
