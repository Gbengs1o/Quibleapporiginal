import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface RiderLoaderProps {
    message?: string;
    size?: number;
    fullScreen?: boolean;
}

const RiderLoader: React.FC<RiderLoaderProps> = ({
    message = 'Loading...',
    size = 200,
    fullScreen = true
}) => {
    const Container = fullScreen ? ThemedView : View;

    return (
        <Container style={[styles.container, fullScreen && styles.fullScreen]}>
            <LottieView
                source={{ uri: 'https://lottie.host/48f61870-2123-4747-9616-6f24a597eaa2/r4b8jStJoh.lottie' }}
                autoPlay
                loop
                style={{ width: size, height: size }}
            />
            {message && (
                <ThemedText style={styles.message}>{message}</ThemedText>
            )}
        </Container>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreen: {
        flex: 1,
    },
    message: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.7,
    },
});

export default RiderLoader;
