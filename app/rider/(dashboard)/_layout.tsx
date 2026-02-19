import RequestAlert from '@/components/RequestAlert';
import RiderDrawerOverlay from '@/components/RiderDrawerOverlay';
import StatusGuard from '@/components/StatusGuard';
import { useAuth } from '@/contexts/auth';
import { RiderMenuProvider } from '@/contexts/rider-menu';
import { Stack } from 'expo-router';

export default function RiderDashboardLayout() {
    const { user } = useAuth();

    return (
        <RiderMenuProvider>
            <StatusGuard type="rider">
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="profile" />
                    <Stack.Screen name="deliveries" />
                    <Stack.Screen name="messages" />
                    <Stack.Screen name="payments" />
                    <Stack.Screen name="wallet" />
                    <Stack.Screen name="reviews" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="analytics" />
                </Stack>
                <RiderDrawerOverlay />
                {user && <RequestAlert riderId={user.id} />}
            </StatusGuard>
        </RiderMenuProvider>
    );
}

