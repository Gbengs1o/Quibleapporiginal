import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedProps,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop, Use } from 'react-native-svg';

// The Logo Paths
const LOGO_PATH_1 = "M75.5232 101.208C76.4578 100.545 81.8062 96.7493 88.3653 94.1295C90.5562 93.2545 106.084 112.919 107.022 114.147C115.9 125.759 122.89 131.286 118.853 133.458C118.072 133.879 96.0552 138.101 91.7802 138.579C56.3704 142.541 28.1686 125.367 15.8657 110.814C-15.8672 73.2752 9.43338 41.3521 11.6344 37.9971C17.1588 29.5763 30.5144 18.9526 32.4756 17.8174C33.0538 17.4826 37.0288 22.9408 43.1438 29.7137C45.3253 32.1298 37.5928 34.7163 29.7981 46.93C15.3712 69.5352 25.2093 98.0802 51.897 112.203C61.5213 117.296 61.9477 116.601 66.2719 118.393C69.9225 119.906 84.5902 122.741 83.3406 118.81C81.6658 113.541 67.4348 107.761 75.523 101.208L75.5232 101.208Z";
const LOGO_PATH_2 = "M142.242 144.531C131.816 136.117 115.902 106.089 96.3664 89.4959C95.8096 89.0228 95.5498 88.3117 103.811 83.9826C109.954 80.7636 112.6 80.3128 114.318 80.1458C120.151 79.579 123.166 88.8979 130.343 96.0688C134.451 100.174 137.153 98.8286 141.379 92.2456C156.221 69.1249 145.223 40.5553 123.603 27.4187C101.019 13.6967 79.9493 15.3754 59.2863 22.3981C51.5632 25.0229 51.3032 26.349 50.4314 25.2234C41.3561 13.5058 40.7604 13.8251 40.0805 12.7571C39.538 11.905 52.0876 6.56428 56.1498 5.22571C118.397 -15.2868 181.111 27.8939 169.631 77.2129C166.405 91.07 159.236 99.9239 156.957 103.115C151.739 110.422 147.173 112.387 147.761 115.918C148.684 121.467 169.356 134.071 158.54 139.625C152.487 142.733 146.901 148.209 142.242 144.531Z";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

interface LiquidLogoProps {
    isDark?: boolean;
}

export default function LiquidLogo({ isDark = true }: LiquidLogoProps) {
    // Shared Values for Animation
    const strokeProgress = useSharedValue(0);
    const fillLevel = useSharedValue(160); // Start below viewbox
    const waveRotateBack = useSharedValue(0);
    const waveRotateFront = useSharedValue(0);
    const sheenX = useSharedValue(-200);

    useEffect(() => {
        // 1. Draw Glass (Stroke)
        strokeProgress.value = withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) });

        // 2. Fill Up Liquid
        fillLevel.value = withDelay(500, withTiming(-20, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) }));

        // 3. Spin Waves - Infinite
        waveRotateBack.value = withRepeat(
            withTiming(360, { duration: 6000, easing: Easing.linear }),
            -1,
            false
        );
        waveRotateFront.value = withRepeat(
            withTiming(360, { duration: 4000, easing: Easing.linear }),
            -1,
            false
        );

        // 4. Sheen Pass - Infinite
        const runSheen = () => {
            sheenX.value = -200;
            sheenX.value = withDelay(2000, withTiming(200, { duration: 1500, easing: Easing.inOut(Easing.ease) }, (finished) => {
                if (finished) runOnJS(runSheen)();
            }));
        };
        runSheen();

    }, []);

    const strokeProps = useAnimatedProps(() => ({
        strokeDashoffset: interpolate(strokeProgress.value, [0, 1], [600, 0]),
        opacity: interpolate(strokeProgress.value, [0, 0.2, 1], [0, 1, 0.5]),
    }));

    const fillContainerProps = useAnimatedProps(() => ({
        transform: [{ translateY: fillLevel.value }]
    }));

    const waveBackProps = useAnimatedProps(() => ({
        transform: [{ rotate: `${waveRotateBack.value}deg` }]
    }));

    const waveFrontProps = useAnimatedProps(() => ({
        transform: [{ rotate: `-${waveRotateFront.value}deg` }] // Reverse rotation
    }));

    const sheenProps = useAnimatedProps(() => ({
        transform: [{ translateX: sheenX.value }, { skewX: '-20deg' }],
        opacity: interpolate(sheenX.value, [-150, 0, 150], [0, 1, 0]),
    }));

    // Colors
    const WAVE_BACK_COLOR = "#c9620b";
    const WAVE_FRONT_COLOR = "#F4821F"; // Logo Orange
    const STROKE_COLOR = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(31, 32, 80, 0.4)";
    const BG_COLOR = isDark ? '#111111' : '#FFFFFF';

    const renderSvgContent = () => (
        <Svg viewBox="0 0 171 146" style={{ width: '100%', height: '100%' }}>
            <Defs>
                <Path id="path1" d={LOGO_PATH_1} />
                <Path id="path2" d={LOGO_PATH_2} />

                <ClipPath id="logo-clip">
                    <Use href="#path1" />
                    <Use href="#path2" />
                </ClipPath>

                <LinearGradient id="sheen-gradient" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="white" stopOpacity="0" />
                    <Stop offset="0.5" stopColor="white" stopOpacity="0.8" />
                    <Stop offset="1" stopColor="white" stopOpacity="0" />
                </LinearGradient>
            </Defs>

            {/* LAYER 1: The Liquid Animation (Clipped) */}
            <G clipPath="url(#logo-clip)">
                {/* Rising Container */}
                <AnimatedG animatedProps={fillContainerProps}>
                    {/* Back Wave */}
                    <AnimatedRect
                        x="-100" y="-100" width="400" height="400" rx="140"
                        fill={WAVE_BACK_COLOR}
                        origin="100, 100"
                        animatedProps={waveBackProps}
                    />

                    {/* Front Wave */}
                    <AnimatedRect
                        x="-100" y="-100" width="400" height="400" rx="130"
                        fill={WAVE_FRONT_COLOR}
                        origin="100, 100"
                        animatedProps={waveFrontProps}
                    />
                </AnimatedG>

                {/* The Sheen Layer */}
                <AnimatedRect
                    x="-50" y="-50" width="300" height="300"
                    fill="url(#sheen-gradient)"
                    animatedProps={sheenProps}
                />
            </G>

            {/* LAYER 2: Glass Container (Stroke) */}
            <G>
                <AnimatedPath
                    d={LOGO_PATH_1}
                    fill="none"
                    stroke={STROKE_COLOR}
                    strokeWidth="1.5"
                    strokeDasharray="600"
                    animatedProps={strokeProps}
                />
                <AnimatedPath
                    d={LOGO_PATH_2}
                    fill="none"
                    stroke={STROKE_COLOR}
                    strokeWidth="1.5"
                    strokeDasharray="600"
                    animatedProps={strokeProps}
                />
            </G>

        </Svg>
    );

    return (
        <View style={styles.wrapper}>
            {/* Main Logo Container */}
            <View style={styles.container}>
                {renderSvgContent()}
            </View>

            {/* Reflection Container */}
            <View style={styles.reflectionContainer}>
                <View style={styles.reflectionContent}>
                    {renderSvgContent()}
                </View>

                {/* The Fade Mask using LinearGradient */}
                <ExpoLinearGradient
                    colors={['transparent', BG_COLOR]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 0.7 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        width: 300,
        height: 300,
    },
    reflectionContainer: {
        width: 300,
        height: 150, // Only show top half of reflection
        marginTop: -30, // Pull up to meet the logo
        overflow: 'hidden',
        opacity: 0.3, // CSS said reflection
    },
    reflectionContent: {
        width: 300,
        height: 300,
        transform: [{ scaleY: -1 }], // Flip vertically
    }
});
