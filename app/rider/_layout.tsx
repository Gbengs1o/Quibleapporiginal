import { RiderNotificationsProvider } from '@/contexts/rider-notifications';
import { Stack } from 'expo-router';
import React from 'react';

export default function RiderLayout() {
    return (
        <RiderNotificationsProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="register" />
                <Stack.Screen name="(dashboard)" />
            </Stack>
        </RiderNotificationsProvider>
    );
}
