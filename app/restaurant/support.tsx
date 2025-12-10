import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function SupportScreen() {
    const navigation = useNavigation();

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                    <Ionicons name="menu" size={24} color="#000" />
                </TouchableOpacity>
                <ThemedText type="title">Support & Help</ThemedText>
                <View style={{ width: 24 }} />
            </View>
            <View style={styles.content}>
                <ThemedText style={styles.placeholderText}>Support & Help content coming soon...</ThemedText>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderText: {
        fontSize: 16,
        opacity: 0.6,
    },
});
