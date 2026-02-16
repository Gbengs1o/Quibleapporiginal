import { useThemeColor } from '@/hooks/use-theme-color';
import { Stack } from 'expo-router';

export default function SendPackageLayout() {
    const bg = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
    return (
        <Stack screenOptions={{
            contentStyle: { backgroundColor: bg },
            headerShown: false
        }}>
            <Stack.Screen name="index" />
        </Stack>
    );
}
