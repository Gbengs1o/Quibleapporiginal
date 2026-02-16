import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface FoodLoaderProps {
    message?: string;
    size?: number;
    fullScreen?: boolean;
}

export default function FoodLoader({ message = "Loading...", size = 200, fullScreen = true }: FoodLoaderProps) {
    const content = (
        <View style={styles.container}>
            <LottieView
                source={{ uri: 'https://lottie.host/32460ed7-5572-49d4-9b11-8096eee3437b/TzG7GfevAR.lottie' }}
                style={{ width: size, height: size }}
                autoPlay
                loop
            />
            {message && <ThemedText style={styles.message}>{message}</ThemedText>}
        </View>
    );

    if (fullScreen) {
        return <ThemedView style={styles.fullScreen}>{content}</ThemedView>;
    }

    return content;
}

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    message: {
        marginTop: 10,
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center',
    },
});
