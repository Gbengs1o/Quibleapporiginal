import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase Admin Client (Service Role) to fetch tokens
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json();

        // Check if this is a database webhook payload
        // Expected format: { type: 'INSERT', table: 'notifications', record: { ... } }
        const { type, table, record } = payload;

        if (type !== 'INSERT' || table !== 'notifications') {
            return new Response(JSON.stringify({ message: 'Ignored: Not an INSERT on notifications table' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const notification = record;

        if (!notification.user_id) {
            throw new Error('Notification record missing user_id');
        }

        // 1. Fetch the User's Push Token
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('expo_push_token')
            .eq('id', notification.user_id)
            .single();

        if (profileError || !profile?.expo_push_token) {
            console.log(`No push token found for user ${notification.user_id}`);
            return new Response(JSON.stringify({ message: 'No push token found for user' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 2. Construct the Expo Push Message
        const message = {
            to: profile.expo_push_token,
            sound: 'default',
            title: notification.title,
            body: notification.message,
            data: {
                ...notification.meta_data,
                url: `/notifications/${notification.id}` // Default deep link
            },
        };

        // 3. Send to Expo
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Push Notification Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
