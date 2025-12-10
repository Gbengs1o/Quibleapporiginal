import { Alert } from 'react-native';

// Monnify Configuration (SANDBOX)
const MONNIFY_CONFIG = {
    apiKey: 'MK_TEST_CVY7LUQVWN',
    secretKey: '18J3SD6JRYLBFLH2R8CHN38JZ9M6HZCL',
    baseUrl: 'https://sandbox.monnify.com',
    contractCode: '1690088224',
    walletAccount: '5843961825'
};

/**
 * Encodes Credentials for Basic Auth
 */
const getEncodedCredentials = () => {
    return btoa(`${MONNIFY_CONFIG.apiKey}:${MONNIFY_CONFIG.secretKey}`);
};

/**
 * 1. Authenticate and get Access Token
 */
export const getMonnifyAccessToken = async () => {
    try {
        const response = await fetch(`${MONNIFY_CONFIG.baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${getEncodedCredentials()}`
            }
        });

        const data = await response.json();
        if (data.requestSuccessful && data.responseBody?.accessToken) {
            return data.responseBody.accessToken;
        } else {
            console.error('Monnify Auth Failed:', data);
            throw new Error(data.responseMessage || 'Authentication failed');
        }
    } catch (error) {
        console.error('Monnify Auth Error:', error);
        throw error;
    }
};

/**
 * 2. Initialize Payment Helper
 * In a real app, this would redirect to Monnify's checkout page or use their SDK.
 * For this "Simulation" with real Keys, we'll try to use their Checkout Link generation if possible,
 * or fall back to a simulation that verifies "Success" against our backend manually.
 * 
 * Since the user asked for "Real keys" but we are in a mobile app without a backend server to handle webhooks technically exposed (unless we use Edge Functions),
 * We will verify the transaction on the client side for this demo (Not secure for production, but user asked for it to "Work").
 */
export const initializeTransaction = async (amount: number, userEmail: string, userName: string) => {
    try {
        const accessToken = await getMonnifyAccessToken();
        const paymentReference = `QUIBLE_${Math.floor(Math.random() * 1000000000)}`;

        const payload = {
            amount: amount,
            customerName: userName,
            customerEmail: userEmail,
            paymentReference: paymentReference,
            paymentDescription: "Wallet Top Up",
            currencyCode: "NGN",
            contractCode: MONNIFY_CONFIG.contractCode,
            redirectUrl: "https://quible.app/payment-success",
            paymentMethods: ["CARD", "ACCOUNT_TRANSFER"]
        };

        const response = await fetch(`${MONNIFY_CONFIG.baseUrl}/api/v1/merchant/transactions/init-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.requestSuccessful && data.responseBody?.checkoutUrl) {
            return {
                checkoutUrl: data.responseBody.checkoutUrl,
                paymentReference: paymentReference
            };
        } else {
            throw new Error(data.responseMessage || 'Failed to initialize transaction');
        }

    } catch (error: any) {
        Alert.alert('Payment Error', error.message);
        return null;
    }
};

/**
 * 3. Verify Transaction
 */
export const verifyTransaction = async (paymentReference: string) => {
    try {
        const accessToken = await getMonnifyAccessToken();

        // Encode reference if standard fetch issues occur, but usually not needed for query param
        const response = await fetch(`${MONNIFY_CONFIG.baseUrl}/api/v2/transactions/${encodeURIComponent(paymentReference)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        return data.requestSuccessful && data.responseBody?.paymentStatus === 'PAID';
    } catch (error) {
        console.error('Verification Error:', error);
        return false;
    }
};
/**
 * 4. Get List of Banks
 */
export const getBanks = async () => {
    try {
        const accessToken = await getMonnifyAccessToken();
        const response = await fetch(`${MONNIFY_CONFIG.baseUrl}/api/v1/banks`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        if (data.requestSuccessful && data.responseBody) {
            return data.responseBody; // Array of { name, code, ... }
        }
        return [];
    } catch (error) {
        console.error('Get Banks Error:', error);
        return [];
    }
};

/**
 * 5. Verify Bank Account
 */
export const verifyBankAccount = async (accountNumber: string, bankCode: string) => {
    try {
        const accessToken = await getMonnifyAccessToken();
        const response = await fetch(`${MONNIFY_CONFIG.baseUrl}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        if (data.requestSuccessful && data.responseBody) {
            return data.responseBody; // { accountName, accountNumber, bankCode }
        }
        return null;
    } catch (error) {
        console.error('Verify Account Error:', error);
        return null; // Return null on failure
    }
};
