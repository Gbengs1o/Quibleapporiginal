import { Alert } from 'react-native';
import { supabase } from './supabase';

// Keys are now managed on the backend (Edge Function)
// We proxy all calls through 'payment-service'

/**
 * 1. Initialize Transaction (Proxied)
 */
export const initializeTransaction = async (amount: number, userEmail: string, userName: string) => {
    try {
        const paymentReference = `QUIBLE_${Math.floor(Math.random() * 1000000000)}`;

        const { data, error } = await supabase.functions.invoke('payment-service', {
            body: {
                action: 'init_transaction',
                payload: {
                    amount,
                    userEmail,
                    userName,
                    paymentReference
                }
            }
        });

        if (error) throw error;

        // Edge function returns the Monnify response body directly or wrapper
        // Our Edge Function returns { requestSuccessful: true, responseBody: { ... } }

        if (data && data.requestSuccessful && data.responseBody?.checkoutUrl) {
            return {
                checkoutUrl: data.responseBody.checkoutUrl,
                paymentReference: paymentReference
            };
        } else {
            throw new Error(data?.responseMessage || 'Failed to initialize transaction');
        }

    } catch (error: any) {
        console.error('Payment Init Error:', error);
        Alert.alert('Payment Error', error.message || 'Could not initialize payment');
        return null;
    }
};

/**
 * 2. Verify Transaction & Credit Wallet (Server-Side)
 * This is the ONLY way to fund a wallet. The client just asks, the server validates.
 */
export const verifyTransaction = async (paymentReference: string) => {
    try {
        const { data: { user } } = await supabase.auth.getUser(); // Get current user
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase.functions.invoke('payment-service', {
            body: {
                action: 'verify_and_credit_wallet',
                payload: {
                    reference: paymentReference,
                    userId: user.id
                }
            }
        });

        if (error) throw error;

        // The Edge Function returns the RPC result directly as 'result' or wraps it.
        // Our Edge Function wrapper usually returns: { success: true, message: ... } inside the response.
        // But note: Deno code does: return new Response(JSON.stringify(result)) -> result IS the rpcData

        // Let's check format: 'result' from generic function is `rpcData`. 
        // `rpcData` from `credit_wallet_internal` is { success: boolean, message: string }

        return data && data.success === true;
    } catch (error) {
        // Check if it's a FunctionsHttpError (Edge Function failure)
        if (error && typeof error === 'object' && 'context' in error) {
            console.warn('Verification Warning (Edge Function):', error);
        } else {
            console.warn('Verification Error:', error);
        }
        return false;
    }
};

/**
 * 3. Get Banks (Proxied)
 */
export const getBanks = async () => {
    try {
        const { data, error } = await supabase.functions.invoke('payment-service', {
            body: { action: 'get_banks', payload: {} }
        });

        if (error) {
            console.error('Get Banks Function Error:', error);
            return [];
        }

        if (data && data.requestSuccessful && data.responseBody) {
            return data.responseBody;
        }
        return [];
    } catch (error) {
        console.error('Get Banks Error:', error);
        return [];
    }
};

/**
 * 4. Verify Bank Account (Proxied)
 */
export const verifyBankAccount = async (accountNumber: string, bankCode: string) => {
    try {
        const { data, error } = await supabase.functions.invoke('payment-service', {
            body: {
                action: 'verify_account',
                payload: { accountNumber, bankCode }
            }
        });

        if (error) return null;

        if (data && data.requestSuccessful && data.responseBody) {
            return data.responseBody;
        }
        return null;
    } catch (error) {
        console.error('Verify Account Error:', error);
        return null;
    }
};

