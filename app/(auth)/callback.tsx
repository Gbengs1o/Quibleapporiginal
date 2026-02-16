import LogoLoader from '@/components/LogoLoader';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/utils/supabase';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function AuthCallback() {
    const { session, isReady } = useAuth();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(true);

    // Manual extraction if session update is slow
    useEffect(() => {
        const handleUrl = async () => {
            try {
                const url = await Linking.getInitialURL();
                if (url) {
                    // Extract params manually from hash
                    const hashIndex = url.indexOf('#');
                    if (hashIndex !== -1) {
                        const hash = url.substring(hashIndex + 1);
                        const params: { [key: string]: string } = {};
                        hash.split('&').forEach(pair => {
                            const [key, value] = pair.split('=');
                            if (key && value) params[key] = decodeURIComponent(value);
                        });

                        if (params.access_token && params.refresh_token) {
                            console.log('Callback: Found tokens in URL, setting session...');
                            const { error } = await supabase.auth.setSession({
                                access_token: params.access_token,
                                refresh_token: params.refresh_token,
                            });
                            if (error) throw error;
                            // Let the session listener redirect
                        }
                    }
                }
            } catch (e) {
                console.error('Callback error:', e);
            } finally {
                setIsProcessing(false);
            }
        };

        if (!session) {
            handleUrl();
        }
    }, [session]);


    if (session) {
        console.log('Callback: Session active, redirecting...');
        return <Redirect href="/(tabs)/Home" />;
    }

    // Fallback redirect if checking is done but no session (maybe failed or was just an empty callback ref)
    if (!isProcessing && !session && isReady) {
        // Maybe unauthorized or just weird state. Go to index to sort it out.
        return <Redirect href="/" />;
    }

    return (
        <View style={styles.container}>
            <LogoLoader size={80} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
