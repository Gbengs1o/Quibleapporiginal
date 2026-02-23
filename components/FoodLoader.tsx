import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface FoodLoaderProps {
    message?: string;
    size?: number;
    fullScreen?: boolean;
    type?: 'restaurant' | 'store';
}

const ANIMATIONS = {
    restaurant: 'https://lottie.host/32460ed7-5572-49d4-9b11-8096eee3437b/TzG7GfevAR.lottie',
    store: 'https://lottie.host/cb2b36c4-f2d3-4d46-95cb-2840f8056cd3/xW3cOWzsY2.lottie'
};

export default function FoodLoader({ message = "Loading...", size = 200, fullScreen = true, type = 'restaurant' }: FoodLoaderProps) {
    const content = (
        <View style={styles.container}>
            <LottieView
                source={{ uri: ANIMATIONS[type] }}
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
