import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

// The SVG Paths provided
const LOGO_PATHS = [
    "M75.5232 101.208C76.4578 100.545 81.8062 96.7493 88.3653 94.1295C90.5562 93.2545 106.084 112.919 107.022 114.147C115.9 125.759 122.89 131.286 118.853 133.458C118.072 133.879 96.0552 138.101 91.7802 138.579C56.3704 142.541 28.1686 125.367 15.8657 110.814C-15.8672 73.2752 9.43338 41.3521 11.6344 37.9971C17.1588 29.5763 30.5144 18.9526 32.4756 17.8174C33.0538 17.4826 37.0288 22.9408 43.1438 29.7137C45.3253 32.1298 37.5928 34.7163 29.7981 46.93C15.3712 69.5352 25.2093 98.0802 51.897 112.203C61.5213 117.296 61.9477 116.601 66.2719 118.393C69.9225 119.906 84.5902 122.741 83.3406 118.81C81.6658 113.541 67.4348 107.761 75.523 101.208L75.5232 101.208Z",
    "M142.242 144.531C131.816 136.117 115.902 106.089 96.3664 89.4959C95.8096 89.0228 95.5498 88.3117 103.811 83.9826C109.954 80.7636 112.6 80.3128 114.318 80.1458C120.151 79.579 123.166 88.8979 130.343 96.0688C134.451 100.174 137.153 98.8286 141.379 92.2456C156.221 69.1249 145.223 40.5553 123.603 27.4187C101.019 13.6967 79.9493 15.3754 59.2863 22.3981C51.5632 25.0229 51.3032 26.349 50.4314 25.2234C41.3561 13.5058 40.7604 13.8251 40.0805 12.7571C39.538 11.905 52.0876 6.56428 56.1498 5.22571C118.397 -15.2868 181.111 27.8939 169.631 77.2129C166.405 91.07 159.236 99.9239 156.957 103.115C151.739 110.422 147.173 112.387 147.761 115.918C148.684 121.467 169.356 134.071 158.54 139.625C152.487 142.733 146.901 148.209 142.242 144.531Z"
];

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedView = Animated.createAnimatedComponent(View);

export default function GlitchLogo() {
    const cyanX = useSharedValue(0);
    const cyanY = useSharedValue(0);

    const magentaX = useSharedValue(0);
    const magentaY = useSharedValue(0);

    const whiteY = useSharedValue(0);
    const whiteScale = useSharedValue(1);

    // Glow pulsing
    const glowOpacity = useSharedValue(0.4);
    const glowScale = useSharedValue(1);

    useEffect(() => {
        // 1. Cyan Glitch Animation (glitch-anim-1)
        // 0% { -2, -2 } -> 20% { 4, 1 } -> 40% { -1, 3 } -> 60% { 2, 0 } -> 80% { -3, -2 } -> 100% { 0, 0 }
        // Duration: 3s
        // Loop: Infinite, Alternate-Reverse (Reanimated 'true' in withRepeat does alternate. To get reverse start, we just start the sequence naturally)
        const cyanConfig = { duration: 500, easing: Easing.linear };
        cyanX.value = withRepeat(
            withSequence(
                withTiming(-2, cyanConfig), withTiming(4, cyanConfig), withTiming(-1, cyanConfig),
                withTiming(2, cyanConfig), withTiming(-3, cyanConfig), withTiming(0, cyanConfig)
            ), -1, true
        );
        cyanY.value = withRepeat(
            withSequence(
                withTiming(-2, cyanConfig), withTiming(1, cyanConfig), withTiming(3, cyanConfig),
                withTiming(0, cyanConfig), withTiming(-2, cyanConfig), withTiming(0, cyanConfig)
            ), -1, true
        );

        // 2. Magenta Glitch Animation (glitch-anim-2)
        const magConfig = { duration: 666, easing: Easing.linear }; // ~4s total for 6 steps
        magentaX.value = withRepeat(
            withSequence(
                withTiming(2, magConfig), withTiming(-3, magConfig), withTiming(1, magConfig),
                withTiming(-2, magConfig), withTiming(3, magConfig), withTiming(0, magConfig)
            ), -1, true
        );
        magentaY.value = withRepeat(
            withSequence(
                withTiming(2, magConfig), withTiming(0, magConfig), withTiming(-3, magConfig),
                withTiming(2, magConfig), withTiming(1, magConfig), withTiming(0, magConfig)
            ), -1, true
        );

        // 3. Float Main (float-main)
        whiteY.value = withRepeat(
            withSequence(
                withTiming(-5, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
            ), -1, true
        );
        whiteScale.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
            ), -1, true
        );

        // 4. Glow Pulse mimicking 'box-shadow' glow from CSS
        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 2000 }),
                withTiming(0.4, { duration: 2000 })
            ), -1, true
        );
        glowScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 2000 }),
                withTiming(1, { duration: 2000 })
            ), -1, true
        );

    }, []);

    const cyanStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: cyanX.value }, { translateY: cyanY.value }],
        opacity: 0.7,
    }));

    const magentaStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: magentaX.value }, { translateY: magentaY.value }],
        opacity: 0.7,
    }));

    const whiteStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: whiteY.value }, { scale: whiteScale.value }],
        opacity: 0.9,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: glowScale.value }],
    }));

    return (
        <View style={styles.container}>
            {/* Glow Layer */}
            <AnimatedView style={[styles.glow, glowStyle]} />

            {/* Layer 1: Cyan */}
            <AnimatedView style={[StyleSheet.absoluteFill, cyanStyle]}>
                <Svg viewBox="0 0 171 146" style={{ width: '100%', height: '100%' }}>
                    <Path d={LOGO_PATHS[0]} fill="#00f2ff" />
                    <Path d={LOGO_PATHS[1]} fill="#00f2ff" />
                </Svg>
            </AnimatedView>

            {/* Layer 2: Magenta */}
            <AnimatedView style={[StyleSheet.absoluteFill, magentaStyle]}>
                <Svg viewBox="0 0 171 146" style={{ width: '100%', height: '100%' }}>
                    <Path d={LOGO_PATHS[0]} fill="#ff0055" />
                    <Path d={LOGO_PATHS[1]} fill="#ff0055" />
                </Svg>
            </AnimatedView>

            {/* Layer 3: White Main */}
            <AnimatedView style={[StyleSheet.absoluteFill, whiteStyle]}>
                <Svg viewBox="0 0 171 146" style={{ width: '100%', height: '100%' }}>
                    <Path d={LOGO_PATHS[0]} fill="#ffffff" />
                    <Path d={LOGO_PATHS[1]} fill="#ffffff" />
                </Svg>
            </AnimatedView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 200,
        height: 170, // Aspect ratio roughly matches viewBox 171:146
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    glow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(139, 92, 246, 0.5)', // #8b5cf6 equivalent
        shadowColor: '#8b5cf6',
        shadowOpacity: 0.8,
        shadowRadius: 40,
        elevation: 30, // Strong Android glow
    }
});
