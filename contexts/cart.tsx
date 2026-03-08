import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CartItem {
    id: string;
    itemId: string;
    type: 'food' | 'store';
    name: string;
    description: string;
    price: number;
    quantity: number;
    image_url: string | null;
    restaurant?: {
        id: string;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
    };
    store?: {
        id: string;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
    };
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void;
    removeFromCart: (id: string) => void;
    removeByItemId: (itemId: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    getItemCount: () => number;
    getTotal: () => number;
    isInCart: (itemId: string) => boolean;
    getItem: (itemId: string) => CartItem | undefined;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = '@quible_cart';

const hasValidCoordinates = (vendor: any) =>
    typeof vendor?.latitude === 'number' && Number.isFinite(vendor.latitude) &&
    typeof vendor?.longitude === 'number' && Number.isFinite(vendor.longitude);

const isValidCartItem = (item: any): item is CartItem => {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.itemId !== 'string' || !item.itemId) return false;
    if (typeof item.id !== 'string' || !item.id) return false;
    if (typeof item.name !== 'string' || !item.name) return false;
    if (typeof item.price !== 'number' || !Number.isFinite(item.price)) return false;
    if (typeof item.quantity !== 'number' || item.quantity <= 0) return false;
    if (item.type !== 'food' && item.type !== 'store') return false;

    if (item.type === 'food') {
        return !!(item.restaurant?.id && hasValidCoordinates(item.restaurant));
    }

    return !!(item.store?.id && hasValidCoordinates(item.store));
};

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
                        setItems(prev =>
                            prev.filter(item =>
                                !(item.type === 'food' && item.itemId === updatedDish.id)
                            )
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'menu_items' },
                (payload: any) => {
                    const deletedDish = payload.old as any;
                    // Remove deleted dish from cart
                    setItems(prev =>
                        prev.filter(item =>
                            !(item.type === 'food' && item.itemId === deletedDish.id)
                        )
                    );
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'store_items' },
                (payload: any) => {
                    const updatedStoreItem = payload.new as any;
                    // Remove inactive or out-of-stock store items
                    if (!updatedStoreItem.is_active || updatedStoreItem.stock_quantity <= 0) {
                        setItems(prev =>
                            prev.filter(item =>
                                !(item.type === 'store' && item.itemId === updatedStoreItem.id)
                            )
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'store_items' },
                (payload: any) => {
                    const deletedStoreItem = payload.old as any;
                    setItems(prev =>
                        prev.filter(item =>
                            !(item.type === 'store' && item.itemId === deletedStoreItem.id)
                        )
                    );
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
                if (!Array.isArray(parsedItems)) {
                    setItems([]);
                    return;
                }

                // Self-healing: remove malformed legacy rows.
                const validItems = parsedItems.filter(isValidCartItem);

                // Keep storage clean if we dropped invalid rows.
                if (validItems.length !== parsedItems.length) {
                    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validItems));
                }

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

    const addToCart = (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => {
        if (!item?.itemId || (item.type === 'food' && !item.restaurant?.id) || (item.type === 'store' && !item.store?.id)) {
            console.warn('Ignoring invalid cart item payload', item);
            return;
        }
        setItems((prev) => {
            const existingItem = prev.find(i => i.itemId === item.itemId && i.type === item.type);
            if (existingItem) {
                return prev.map(i =>
                    i.itemId === item.itemId && i.type === item.type
                        ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                        : i
                );
            }

            return [...prev, {
                ...item,
                id: `${item.itemId}-${Date.now()}`,
                quantity: item.quantity || 1,
            }];
        });
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const removeByItemId = (itemId: string) => {
        setItems(prev => prev.filter(item => item.itemId !== itemId));
    };

    const updateQuantity = (id: string, quantity: number) => {
        setItems(prev => {
            if (quantity <= 0) {
                return prev.filter(item => item.id !== id);
            }
            return prev.map(item =>
                item.id === id ? { ...item, quantity } : item
            );
        });
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

    const isInCart = (itemId: string) => {
        return items.some(item => item.itemId === itemId);
    };

    const getItem = (itemId: string) => {
        return items.find(item => item.itemId === itemId);
    };

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            removeByItemId,
            updateQuantity,
            clearCart,
            getItemCount,
            getTotal,
            isInCart,
            getItem,
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
