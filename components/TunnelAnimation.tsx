import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const LOGO_PATH_1 = "M75.5232 101.208C76.4578 100.545 81.8062 96.7493 88.3653 94.1295C90.5562 93.2545 106.084 112.919 107.022 114.147C115.9 125.759 122.89 131.286 118.853 133.458C118.072 133.879 96.0552 138.101 91.7802 138.579C56.3704 142.541 28.1686 125.367 15.8657 110.814C-15.8672 73.2752 9.43338 41.3521 11.6344 37.9971C17.1588 29.5763 30.5144 18.9526 32.4756 17.8174C33.0538 17.4826 37.0288 22.9408 43.1438 29.7137C45.3253 32.1298 37.5928 34.7163 29.7981 46.93C15.3712 69.5352 25.2093 98.0802 51.897 112.203C61.5213 117.296 61.9477 116.601 66.2719 118.393C69.9225 119.906 84.5902 122.741 83.3406 118.81C81.6658 113.541 67.4348 107.761 75.523 101.208L75.5232 101.208Z";
const LOGO_PATH_2 = "M142.242 144.531C131.816 136.117 115.902 106.089 96.3664 89.4959C95.8096 89.0228 95.5498 88.3117 103.811 83.9826C109.954 80.7636 112.6 80.3128 114.318 80.1458C120.151 79.579 123.166 88.8979 130.343 96.0688C134.451 100.174 137.153 98.8286 141.379 92.2456C156.221 69.1249 145.223 40.5553 123.603 27.4187C101.019 13.6967 79.9493 15.3754 59.2863 22.3981C51.5632 25.0229 51.3032 26.349 50.4314 25.2234C41.3561 13.5058 40.7604 13.8251 40.0805 12.7571C39.538 11.905 52.0876 6.56428 56.1498 5.22571C118.397 -15.2868 181.111 27.8939 169.631 77.2129C166.405 91.07 159.236 99.9239 156.957 103.115C151.739 110.422 147.173 112.387 147.761 115.918C148.684 121.467 169.356 134.071 158.54 139.625C152.487 142.733 146.901 148.209 142.242 144.531Z";

const LAYERS = [
    { color: '#240046', delay: 0.0 },
    { color: '#3c096c', delay: 0.4 },
    { color: '#5a189a', delay: 0.8 },
    { color: '#7b2cbf', delay: 1.2 },
    { color: '#9d4edd', delay: 1.6 },
    { color: '#c77dff', delay: 2.0 },
    { color: '#ff9e00', delay: 2.4 },
    { color: '#ff9100', delay: 2.8 },
    { color: '#ff8500', delay: 3.2 },
    { color: '#F4821F', delay: 3.6 },
];

const LIGHT_LAYERS = [
    { color: '#E0E0E0', delay: 0.0 },
    { color: '#BDBDBD', delay: 0.4 },
    { color: '#9E9E9E', delay: 0.8 },
    { color: '#757575', delay: 1.2 },
    { color: '#616161', delay: 1.6 },
    { color: '#424242', delay: 2.0 },
    { color: '#FFB74D', delay: 2.4 },
    { color: '#FF9800', delay: 2.8 },
    { color: '#F57C00', delay: 3.2 },
    { color: '#F27C22', delay: 3.6 }, // Brand color
];

interface TunnelLayerProps {
    delay: number;
    color: string;
    theme: 'dark' | 'light';
}

const TunnelLayer = ({ delay, color, theme }: TunnelLayerProps) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            delay * 1000,
            withRepeat(
                withTiming(1, {
                    duration: 4000,
                    easing: Easing.bezier(0.55, 0.055, 0.675, 0.19),
                }),
                -1,
                false
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(progress.value, [0, 1], [0.1, 2.5]);
        const rotate = interpolate(progress.value, [0, 1], [0, 10]);
        // Note: strokeWidth cannot be easily animated on plain SVG Path without reanimated props,
        // so we opacity fade instead of stroke width for simplicity and performance in this version.

        let opacity = 0;
        if (progress.value < 0.1) {
            opacity = interpolate(progress.value, [0, 0.1], [0, 1]);
        } else if (progress.value < 0.8) {
            opacity = 1;
        } else {
            opacity = interpolate(progress.value, [0.8, 1], [1, 0]);
        }

        return {
            opacity,
            transform: [
                { scale },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.centered, animatedStyle]}>
            <Svg width="300" height="300" viewBox="0 0 171 146" style={{ opacity: 0.8 }}>
                <Path d={LOGO_PATH_1} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={LOGO_PATH_2} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
        </Animated.View>
    );
};

// Anchor Logic
const AnchorLogo = () => {
    const scale = useSharedValue(0.5); // Initial scale for visible anchor
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        scale.value = withRepeat(
            withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        opacity.value = withRepeat(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.centered, animatedStyle]}>
            <Svg width="300" height="300" viewBox="0 0 171 146">
                <Path d={LOGO_PATH_1} fill="#F27C22" />
                <Path d={LOGO_PATH_2} fill="#F27C22" />
            </Svg>
        </Animated.View>
    );
};

export default function TunnelAnimation({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
    const layers = theme === 'dark' ? LAYERS : LIGHT_LAYERS;

    return (
        <View style={styles.container}>
            <AnchorLogo />
            {layers.map((layer, index) => (
                <TunnelLayer
                    key={index}
                    delay={layer.delay}
                    color={layer.color}
                    theme={theme}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        // Make background transparent so it layers over whatever is behind it
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
