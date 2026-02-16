import { useAuth } from '@/contexts/auth';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { RiderRegistrationProvider } from './_context';

export default function RiderRegisterLayout() {
    const { session, isReady } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (isReady && !session) {
            router.replace('/(auth)/login');
        }
    }, [isReady, session]);

    if (!isReady) {
        return null; // Or a loading spinner
    }

    return (
        <RiderRegistrationProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="step1-personal" />
                <Stack.Screen name="step2-vehicle" />
                <Stack.Screen name="step3-documents" />
                <Stack.Screen name="step4-kin" />
            </Stack>
        </RiderRegistrationProvider>
    );
}
