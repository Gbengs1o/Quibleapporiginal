import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import Svg, {
    Circle,
    Defs,
    G,
    LinearGradient,
    Path,
    Pattern,
    Rect,
    Stop,
} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const PATH_LEFT = "M75.5232 101.208C76.4578 100.545 81.8062 96.7493 88.3653 94.1295C90.5562 93.2545 106.084 112.919 107.022 114.147C115.9 125.759 122.89 131.286 118.853 133.458C118.072 133.879 96.0552 138.101 91.7802 138.579C56.3704 142.541 28.1686 125.367 15.8657 110.814C-15.8672 73.2752 9.43338 41.3521 11.6344 37.9971C17.1588 29.5763 30.5144 18.9526 32.4756 17.8174C33.0538 17.4826 37.0288 22.9408 43.1438 29.7137C45.3253 32.1298 37.5928 34.7163 29.7981 46.93C15.3712 69.5352 25.2093 98.0802 51.897 112.203C61.5213 117.296 61.9477 116.601 66.2719 118.393C69.9225 119.906 84.5902 122.741 83.3406 118.81C81.6658 113.541 67.4348 107.761 75.523 101.208L75.5232 101.208Z";
const PATH_RIGHT = "M142.242 144.531C131.816 136.117 115.902 106.089 96.3664 89.4959C95.8096 89.0228 95.5498 88.3117 103.811 83.9826C109.954 80.7636 112.6 80.3128 114.318 80.1458C120.151 79.579 123.166 88.8979 130.343 96.0688C134.451 100.174 137.153 98.8286 141.379 92.2456C156.221 69.1249 145.223 40.5553 123.603 27.4187C101.019 13.6967 79.9493 15.3754 59.2863 22.3981C51.5632 25.0229 51.3032 26.349 50.4314 25.2234C41.3561 13.5058 40.7604 13.8251 40.0805 12.7571C39.538 11.905 52.0876 6.56428 56.1498 5.22571C118.397 -15.2868 181.111 27.8939 169.631 77.2129C166.405 91.07 159.236 99.9239 156.957 103.115C151.739 110.422 147.173 112.387 147.761 115.918C148.684 121.467 169.356 134.071 158.54 139.625C152.487 142.733 146.901 148.209 142.242 144.531Z";

interface MagmaAnimationProps {
    size?: number;
}

export default function MagmaAnimation({ size = 300 }: MagmaAnimationProps) {
    const pulse = useSharedValue(0);
    const drift = useSharedValue(0);
    const drawLine = useSharedValue(0);
    const magmaRotate = useSharedValue(0);
    const magmaTranslate = useSharedValue(0);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        drift.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        drawLine.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
            -1,
            false
        );

        magmaRotate.value = withRepeat(
            withTiming(1, { duration: 10000, easing: Easing.linear }),
            -1,
            false
        );

        magmaTranslate.value = withRepeat(
            withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedMainGroupProps = useAnimatedProps(() => {
        const scale = interpolate(pulse.value, [0, 1], [1, 1.05]);
        const brightness = interpolate(pulse.value, [0, 1], [1, 1.3]);
        return {
            transform: [{ scale }],
            opacity: brightness, // Simulating brightness with opacity or just using the prop if platform supports
        };
    });

    const animatedLeftProps = useAnimatedProps(() => {
        const tx = interpolate(drift.value, [0, 1], [0, -15]);
        const ty = interpolate(drift.value, [0, 1], [0, 10]);
        const rotate = interpolate(drift.value, [0, 1], [0, -5]);
        return {
            transform: [
                { translateX: tx },
                { translateY: ty },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const animatedRightProps = useAnimatedProps(() => {
        const tx = interpolate(drift.value, [0, 1], [0, 15]);
        const ty = interpolate(drift.value, [0, 1], [0, -10]);
        const rotate = interpolate(drift.value, [0, 1], [0, 5]);
        return {
            transform: [
                { translateX: tx },
                { translateY: ty },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const animatedOutlineProps = useAnimatedProps(() => {
        const offset = interpolate(drawLine.value, [0, 0.5, 1], [600, 0, -600]);
        const opacity = interpolate(drawLine.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
        return {
            strokeDashoffset: offset,
            opacity: opacity,
        };
    });

    // Pattern animation is simulated by animating the circles inside the pattern
    const animatedPatternRectProps = useAnimatedProps(() => {
        const rotate = interpolate(magmaRotate.value, [0, 1], [0, 360]);
        return {
            transform: [{ rotate: `${rotate}deg` }],
        };
    });

    const animatedCircle1Props = useAnimatedProps(() => {
        const tx = interpolate(magmaTranslate.value, [0, 1], [0, 171]);
        const ty = interpolate(magmaTranslate.value, [0, 1], [0, 146]);
        return {
            transform: [{ translateX: tx }, { translateY: ty }],
        };
    });

    const animatedCircle2Props = useAnimatedProps(() => {
        const tx = interpolate(magmaTranslate.value, [0, 1], [0, -171]);
        const ty = interpolate(magmaTranslate.value, [0, 1], [0, -146]);
        return {
            transform: [{ translateX: tx }, { translateY: ty }],
        };
    });

    return (
        <View style={{ width: size, height: size }}>
            <Svg viewBox="0 0 171 146" width="100%" height="100%">
                <Defs>
                    <Pattern id="magma-pattern" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                        <AnimatedG>
                            <AnimatedRect x="0" y="0" width="300" height="300" fill="#F4821F" animatedProps={animatedPatternRectProps} />
                            <AnimatedCircle cx="0" cy="0" r="150" fill="url(#heat-gradient)" animatedProps={animatedCircle1Props} />
                            <AnimatedCircle cx="171" cy="146" r="100" fill="url(#heat-gradient-2)" animatedProps={animatedCircle2Props} />
                        </AnimatedG>
                    </Pattern>

                    <LinearGradient id="heat-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#ffcb8a" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#F4821F" stopOpacity="0" />
                    </LinearGradient>

                    <LinearGradient id="heat-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#ff4d00" stopOpacity="0.8" />
                        <Stop offset="100%" stopColor="#F4821F" stopOpacity="0" />
                    </LinearGradient>
                </Defs>

                <AnimatedG animatedProps={animatedMainGroupProps}>
                    <AnimatedG animatedProps={animatedLeftProps}>
                        <Path d={PATH_LEFT} fill="url(#magma-pattern)" stroke="rgba(244, 130, 31, 0.5)" strokeWidth="1" />
                        <AnimatedPath
                            d={PATH_LEFT}
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeDasharray="600"
                            animatedProps={animatedOutlineProps}
                        />
                    </AnimatedG>

                    <AnimatedG animatedProps={animatedRightProps}>
                        <Path d={PATH_RIGHT} fill="url(#magma-pattern)" stroke="rgba(244, 130, 31, 0.5)" strokeWidth="1" />
                        <AnimatedPath
                            d={PATH_RIGHT}
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeDasharray="600"
                            animatedProps={animatedOutlineProps}
                        />
                    </AnimatedG>
                </AnimatedG>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({});
