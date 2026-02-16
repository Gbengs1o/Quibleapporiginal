import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
    size?: number;
    source?: string | { uri: string };
}

export default function LottieLoader({ size = 150, source }: Props) {
    const defaultSource = { uri: 'https://lottie.host/48f61870-2123-4747-9616-6f24a597eaa2/r4b8jStJoh.lottie' };

    return (
        <View style={styles.container}>
            <LottieView
                source={source || defaultSource}
                autoPlay
                loop
                style={{ width: size, height: size }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
