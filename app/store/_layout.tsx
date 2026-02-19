import CustomDrawerOverlay from '@/components/CustomDrawerOverlay';
import StatusGuard from '@/components/StatusGuard';
import { RestaurantMenuProvider } from '@/contexts/restaurant-menu';
import { Stack } from 'expo-router';

export default function RestaurantLayout() {
    return (
        <RestaurantMenuProvider>
            <StatusGuard type="store">
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="dashboard" />
                    <Stack.Screen name="orders" />
                    <Stack.Screen name="menu" />
                    <Stack.Screen name="payments" />
                    <Stack.Screen name="promotions" />
                    <Stack.Screen name="reviews" />
                    <Stack.Screen name="messages" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="support" />
                    <Stack.Screen name="wallet" />
                    <Stack.Screen name="analytics" />
                </Stack>
                <CustomDrawerOverlay />
            </StatusGuard>
        </RestaurantMenuProvider>
    );
}
