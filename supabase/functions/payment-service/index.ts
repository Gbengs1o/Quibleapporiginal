import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Environment Configuration (Secure)
const MONNIFY_API_KEY = Deno.env.get('MONNIFY_API_KEY');
const MONNIFY_SECRET_KEY = Deno.env.get('MONNIFY_SECRET_KEY');
const MONNIFY_CONTRACT_CODE = Deno.env.get('MONNIFY_CONTRACT_CODE');
const MONNIFY_ENV = Deno.env.get('MONNIFY_ENV') || 'sandbox'; // 'sandbox' or 'production'

if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY || !MONNIFY_CONTRACT_CODE) {
    console.error("Missing Monnify Environment Variables");
}

const BASE_URL = MONNIFY_ENV === 'production'
    ? 'https://api.monnify.com'
    : 'https://sandbox.monnify.com';

// Initialize Supabase Admin Client (Service Role)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getEncodedCredentials = () => {
    return btoa(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`);
};

const getAccessToken = async () => {
    if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY) {
        throw new Error('Server Misconfiguration: Missing API Keys');
    }

    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${getEncodedCredentials()}`
        }
    });
    const data = await response.json();
    if (data.requestSuccessful && data.responseBody?.accessToken) {
        return data.responseBody.accessToken;
    }
    console.error("Monnify Auth Failed:", data);
    throw new Error(data.responseMessage || 'Auth Failed');
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { action, payload } = await req.json();
        const accessToken = await getAccessToken();

        let result;

        if (action === 'init_transaction') {
            const { amount, userEmail, userName, paymentReference, redirectUrl } = payload;
            const monnifyPayload = {
                amount,
                customerName: userName,
                customerEmail: userEmail,
                paymentReference,
                paymentDescription: "Wallet Top Up",
                currencyCode: "NGN",
                contractCode: MONNIFY_CONTRACT_CODE,
                redirectUrl: redirectUrl || "https://quible.app/payment-success",
                paymentMethods: ["CARD", "ACCOUNT_TRANSFER"]
            };

            const response = await fetch(`${BASE_URL}/api/v1/merchant/transactions/init-transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(monnifyPayload)
            });
            result = await response.json();
        }
        else if (action === 'verify_transaction') {
            // Public verify (read-only state)
            const { reference } = payload;
            const response = await fetch(`${BASE_URL}/api/v2/transactions/${encodeURIComponent(reference)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            result = await response.json();
        }
        else if (action === 'verify_and_credit_wallet') {
            // CRITICAL: Server-Side Verification Loop
            const { reference, userId } = payload;

            // 1. Verify with Monnify
            const response = await fetch(`${BASE_URL}/api/v2/transactions/${encodeURIComponent(reference)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const monnifyData = await response.json();

            if (!monnifyData.requestSuccessful || monnifyData.responseBody?.paymentStatus !== 'PAID') {
                throw new Error('Payment not confirmed by provider');
            }

            const amountPaid = monnifyData.responseBody.amountPaid;

            // 2. Credit Wallet via Internal RPC (Service Role)
            const { data: rpcData, error: rpcError } = await supabaseAdmin
                .rpc('credit_wallet_internal', {
                    p_user_id: userId,
                    p_amount: amountPaid,
                    p_reference: reference,
                    p_description: 'Wallet Top Up (Verified)'
                });

            if (rpcError) {
                console.error('RPC Error:', rpcError);
                throw new Error(rpcError.message || 'Failed to credit wallet');
            }

            result = rpcData; // Success/Fail message from DB
        }
        else if (action === 'get_banks') {
            const response = await fetch(`${BASE_URL}/api/v1/banks`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            result = await response.json();
        }
        else if (action === 'verify_account') {
            const { accountNumber, bankCode } = payload;
            const response = await fetch(`${BASE_URL}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            result = await response.json();
        }
        else {
            throw new Error('Invalid Action');
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
