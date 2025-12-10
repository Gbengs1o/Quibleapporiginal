import RestaurantSidebar from '@/components/RestaurantSidebar';
import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RestaurantLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
                drawerContent={(props) => <RestaurantSidebar {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerStyle: {
                        width: '80%',
                    },
                }}
            >
                <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
                <Drawer.Screen name="orders" options={{ title: 'Orders' }} />
                <Drawer.Screen name="menu" options={{ title: 'Menu Management' }} />
                <Drawer.Screen name="payments" options={{ title: 'Payments and Earning' }} />
                <Drawer.Screen name="promotions" options={{ title: 'Promotions' }} />
                <Drawer.Screen name="reviews" options={{ title: 'Reviews' }} />
                <Drawer.Screen name="messages" options={{ title: 'Messages' }} />
                <Drawer.Screen name="settings" options={{ title: 'Profile & Settings' }} />
                <Drawer.Screen name="support" options={{ title: 'Support & Help' }} />
                <Drawer.Screen name="wallet" options={{ title: 'Wallet' }} />
                <Drawer.Screen name="analytics" options={{ title: 'Analytics' }} />
            </Drawer>
        </GestureHandlerRootView>
    );
}
