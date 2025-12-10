import { supabase } from '@/utils/supabase';
import * as Location from 'expo-location'; // Added
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { initializeTransaction, verifyTransaction } from '../utils/monnify';
import { useAuth } from './auth';

type WalletType = 'personal' | 'business';

interface Wallet {
    id: string;
    type: WalletType;
    balance: number;
    user_id?: string;
    restaurant_id?: string;
}

interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    location?: any; // Added
}

interface WalletContextType {
    personalWallet: Wallet | null;
    businessWallet: Wallet | null;
    activeWallet: Wallet | null;
    transactions: Transaction[];
    isLoading: boolean;
    switchWallet: () => void;
    fundWallet: (amount: number) => Promise<void>;
    refreshWallet: () => Promise<void>;
    getCurrentLocation: () => Promise<any>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [personalWallet, setPersonalWallet] = useState<Wallet | null>(null);
    const [businessWallet, setBusinessWallet] = useState<Wallet | null>(null);
    const [activeWalletType, setActiveWalletType] = useState<WalletType>('personal');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter transactions helper

    // Computed active wallet
    const activeWallet = activeWalletType === 'personal' ? personalWallet : businessWallet;

    useEffect(() => {
        if (user) {
            fetchWallets();
        } else {
            setPersonalWallet(null);
            setBusinessWallet(null);
            setActiveWalletType('personal');
            setTransactions([]);
        }
    }, [user]);

    useEffect(() => {
        if (activeWallet) {
            fetchTransactions(activeWallet.id);
        }
    }, [activeWallet]);

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return {};
            const location = await Location.getCurrentPositionAsync({});
            return {
                lat: location.coords.latitude,
                long: location.coords.longitude,
                timestamp: location.timestamp
            };
        } catch (error) {
            console.log("Location Error", error);
            return {};
        }
    };

    const fetchWallets = async () => {
        try {
            setIsLoading(true);
            const { data: pWallet, error: pError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user?.id)
                .eq('type', 'personal')
                .single();

            if (!pError && pWallet) {
                setPersonalWallet(pWallet);
            }

            // Fetch Business Wallet (Linked via Restaurant)
            // Need to join wallets -> restaurants where restaurants.owner_id = user.id
            const { data: bWallet, error: bError } = await supabase
                .from('wallets')
                .select('*, restaurant:restaurants!inner(owner_id)')
                .eq('restaurant.owner_id', user?.id)
                .eq('type', 'business')
                .maybeSingle();

            if (bWallet) {
                // Supabase returns { ...wallet, restaurant: { owner_id: ... } }
                // We just need the wallet part mostly, but having restaurant_id is key
                setBusinessWallet(bWallet as any);
            }

        } catch (error) {
            console.error('Error fetching wallets:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTransactions = async (walletId: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('wallet_id', walletId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setTransactions(data);
        }
    };

    const switchWallet = () => {
        if (!businessWallet) return;
        setActiveWalletType(prev => prev === 'personal' ? 'business' : 'personal');
    };

    const refreshWallet = async () => {
        await fetchWallets();
        if (activeWallet) await fetchTransactions(activeWallet.id);
    };

    const fundWallet = async (amount: number) => {
        if (!personalWallet) return;
        setIsLoading(true);

        try {
            const userEmail = user?.email || 'user@example.com';
            const userName = user?.user_metadata?.first_name || 'Valued User';

            const monnifyData = await initializeTransaction(amount, userEmail, userName);

            if (monnifyData && monnifyData.checkoutUrl) {
                const result = await WebBrowser.openAuthSessionAsync(
                    monnifyData.checkoutUrl,
                    'https://quible.app/payment-success'
                );

                if (result.type === 'dismiss' || result.type === 'success') {
                    const isPaid = await verifyTransaction(monnifyData.paymentReference);

                    if (isPaid) {
                        const location = await getCurrentLocation(); // Get Location
                        const { error } = await supabase.rpc('fund_wallet', {
                            wallet_id: personalWallet.id,
                            amount: amount,
                            reference: monnifyData.paymentReference,
                            p_location: location // Pass Location
                        });

                        if (error) {
                            Alert.alert("Error", "Payment verified but wallet update failed.");
                        } else {
                            Alert.alert("Success", "Wallet funded successfully!");
                            await refreshWallet();
                        }
                    } else {
                        Alert.alert("Payment Cancelled or Failed", "We could not verify your payment.");
                    }
                }
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <WalletContext.Provider value={{
            personalWallet,
            businessWallet,
            activeWallet,
            transactions,
            isLoading,
            switchWallet,
            fundWallet,
            refreshWallet,
            getCurrentLocation // Exporting helper
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
