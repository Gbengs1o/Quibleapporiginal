import { supabase } from '@/utils/supabase';
import * as Location from 'expo-location'; // Added
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { initializeTransaction, verifyTransaction } from '../utils/monnify';
import { useAuth } from './auth';

type WalletType = 'personal' | 'business' | 'rider';

interface Wallet {
    id: string;
    type: WalletType;
    balance: number;
    user_id?: string;
    restaurant?: {
        owner_id: string;
        name: string;
        logo_url: string | null;
    };
    rider?: {
        user_id: string;
    };
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
    riderWallet: Wallet | null;
    activeWallet: Wallet | null;
    transactions: Transaction[];
    isLoading: boolean;
    switchWallet: () => void;
    activateWallet: (type: WalletType) => void;
    fundWallet: (amount: number) => Promise<void>;
    refreshWallet: () => Promise<void>;
    getCurrentLocation: () => Promise<any>;
    transferFunds: (amount: number, recipientEmail: string) => Promise<{ success: boolean; message: string }>;
    requestPayout: (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) => Promise<{ success: boolean; message: string }>;
    resolveRecipient: (email: string) => Promise<{ success: boolean; data?: { name: string }; message?: string }>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [personalWallet, setPersonalWallet] = useState<Wallet | null>(null);
    const [businessWallet, setBusinessWallet] = useState<Wallet | null>(null);
    const [riderWallet, setRiderWallet] = useState<Wallet | null>(null);
    const [activeWalletType, setActiveWalletType] = useState<WalletType>('personal');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter transactions helper

    // Computed active wallet
    const activeWallet =
        activeWalletType === 'personal' ? personalWallet :
            activeWalletType === 'business' ? businessWallet :
                riderWallet;

    useEffect(() => {
        if (user) {
            fetchWallets();
        } else {
            setPersonalWallet(null);
            setBusinessWallet(null);
            setRiderWallet(null);
            setActiveWalletType('personal');
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
                .select('*, restaurant:restaurants!inner(owner_id, name, logo_url)')
                .eq('restaurant.owner_id', user?.id)
                .eq('type', 'business')
                .maybeSingle();

            if (bWallet) {
                // Supabase returns { ...wallet, restaurant: { owner_id: ... } }
                // We just need the wallet part mostly, but having restaurant_id is key
                setBusinessWallet(bWallet as any);
            }

            // Fetch Rider Wallet (separate wallet with type='rider')
            const { data: rWallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user?.id)
                .eq('type', 'rider')
                .maybeSingle();

            if (rWallet) {
                setRiderWallet(rWallet);
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
        // Cycle: Personal -> Business -> Rider -> Personal
        if (activeWalletType === 'personal') {
            if (businessWallet) setActiveWalletType('business');
            else if (riderWallet) setActiveWalletType('rider');
            else setActiveWalletType('personal'); // No other wallets
        }
        else if (activeWalletType === 'business') {
            if (riderWallet) setActiveWalletType('rider');
            else setActiveWalletType('personal');
        }
        else if (activeWalletType === 'rider') {
            setActiveWalletType('personal');
        }
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

    const transferFunds = async (amount: number, recipientEmail: string) => {
        if (!activeWallet) return { success: false, message: 'No active wallet' };

        try {
            const { data, error } = await supabase.rpc('transfer_funds_generic', {
                source_wallet_id: activeWallet.id,
                recipient_email: recipientEmail,
                amount: amount
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            await refreshWallet();
            return { success: true, message: 'Transfer successful' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    };

    const requestPayout = async (amount: number, bankDetails: { bankName: string, accountNumber: string, accountName: string }) => {
        if (!activeWallet) return { success: false, message: 'No active wallet' };

        try {
            const { data, error } = await supabase.rpc('request_payout_generic', {
                source_wallet_id: activeWallet.id,
                amount: amount,
                bank_name: bankDetails.bankName,
                account_number: bankDetails.accountNumber,
                account_name: bankDetails.accountName
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            await refreshWallet();
            return { success: true, message: 'Withdrawal requested successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    };

    const resolveRecipient = async (email: string) => {
        try {
            const { data, error } = await supabase.rpc('get_recipient_name', { recipient_email: email });
            if (error) throw error;
            return data; // { success: boolean, data?: { name: string }, message?: string }
        } catch (error: any) {
            console.error("Resolve Error", error);
            return { success: false, message: error.message };
        }
    };

    return (
        <WalletContext.Provider value={{
            personalWallet,
            businessWallet,
            riderWallet,
            activeWallet,
            transactions,
            isLoading,
            switchWallet,
            activateWallet: setActiveWalletType,
            fundWallet,
            refreshWallet,
            getCurrentLocation,
            transferFunds,
            requestPayout,
            resolveRecipient
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
