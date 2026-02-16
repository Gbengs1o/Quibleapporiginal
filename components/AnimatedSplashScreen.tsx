import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scale the logo to fit nicely on screen
const LOGO_SCALE = Math.min(SCREEN_WIDTH * 0.8, 350) / 575;

interface Props {
    onAnimationComplete?: () => void;
}

export default function AnimatedSplashScreen({ onAnimationComplete }: Props) {
    // Animation values
    const iconTranslateX = useSharedValue(-SCREEN_WIDTH);
    const iconTranslateY = useSharedValue(0);
    const iconRotate = useSharedValue(-15); // Tilted back like speeding
    const iconOpacity = useSharedValue(0);
    const iconScale = useSharedValue(0.6);

    const textOpacity = useSharedValue(0);
    const textTranslateX = useSharedValue(80);
    const textScale = useSharedValue(0.8);

    const floatY = useSharedValue(0);

    // Delivery trail/speed lines
    const speedLine1Opacity = useSharedValue(0);
    const speedLine2Opacity = useSharedValue(0);
    const speedLine3Opacity = useSharedValue(0);

    useEffect(() => {
        // === PHASE 1: Speed In (0-800ms) ===
        // Icon zooms in from far left, tilted like it's speeding
        iconOpacity.value = withTiming(1, { duration: 300 });
        iconTranslateX.value = withSequence(
            // Zoom in fast with overshoot
            withTiming(30, { duration: 600, easing: Easing.out(Easing.exp) }),
            // Brake/settle back
            withSpring(0, { damping: 12, stiffness: 100 })
        );
        // Straighten up as it brakes
        iconRotate.value = withSequence(
            withTiming(8, { duration: 400, easing: Easing.out(Easing.cubic) }), // Lean forward on brake
            withSpring(0, { damping: 10, stiffness: 80 }) // Settle upright
        );
        iconScale.value = withSequence(
            withTiming(1.1, { duration: 500, easing: Easing.out(Easing.cubic) }),
            withSpring(1, { damping: 15, stiffness: 100 })
        );

        // Speed lines flash briefly during entry
        speedLine1Opacity.value = withSequence(
            withDelay(100, withTiming(0.7, { duration: 100 })),
            withTiming(0, { duration: 300 })
        );
        speedLine2Opacity.value = withSequence(
            withDelay(200, withTiming(0.5, { duration: 100 })),
            withTiming(0, { duration: 400 })
        );
        speedLine3Opacity.value = withSequence(
            withDelay(300, withTiming(0.3, { duration: 100 })),
            withTiming(0, { duration: 500 })
        );

        // === PHASE 2: Text Reveal (600-1400ms) ===
        textOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
        textTranslateX.value = withDelay(600, withSpring(0, { damping: 12, stiffness: 80 }));
        textScale.value = withDelay(600, withSpring(1, { damping: 15, stiffness: 100 }));

        // === PHASE 3: Gentle Idle Float (starts at 1500ms, loops forever) ===
        floatY.value = withDelay(1500, withRepeat(
            withSequence(
                withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            false
        ));

        // === Signal completion after 4 seconds ===
        const timer = setTimeout(() => {
            if (onAnimationComplete) {
                onAnimationComplete();
            }
        }, 4000);

        return () => clearTimeout(timer);
    }, []);

    // Animated styles
    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: iconTranslateX.value },
            { translateY: floatY.value },
            { rotate: `${iconRotate.value}deg` },
            { scale: iconScale.value },
        ],
        opacity: iconOpacity.value,
    }));

    const textAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: textTranslateX.value },
            { translateY: floatY.value },
            { scale: textScale.value },
        ],
        opacity: textOpacity.value,
    }));

    const speedLine1Style = useAnimatedStyle(() => ({
        opacity: speedLine1Opacity.value,
    }));
    const speedLine2Style = useAnimatedStyle(() => ({
        opacity: speedLine2Opacity.value,
    }));
    const speedLine3Style = useAnimatedStyle(() => ({
        opacity: speedLine3Opacity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Speed Lines (behind the logo) */}
            <View style={styles.speedLinesContainer}>
                <Animated.View style={[styles.speedLine, styles.speedLine1, speedLine1Style]} />
                <Animated.View style={[styles.speedLine, styles.speedLine2, speedLine2Style]} />
                <Animated.View style={[styles.speedLine, styles.speedLine3, speedLine3Style]} />
            </View>

            <View style={styles.logoContainer}>
                {/* Icon (the delivery scooter graphic) */}
                <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
                    <Svg
                        width={170 * LOGO_SCALE}
                        height={156 * LOGO_SCALE}
                        viewBox="0 0 170 156"
                        fill="none"
                    >
                        <Path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M75.5232 101.208C76.4578 100.545 81.8062 96.7493 88.3653 94.1295C90.5562 93.2545 106.084 112.919 107.022 114.147C115.9 125.759 122.89 131.286 118.853 133.458C118.072 133.879 96.0552 138.101 91.7802 138.579C56.3704 142.541 28.1686 125.367 15.8657 110.814C-15.8672 73.2752 9.43338 41.3521 11.6344 37.9971C17.1588 29.5763 30.5144 18.9526 32.4756 17.8174C33.0538 17.4826 37.0288 22.9408 43.1438 29.7137C45.3253 32.1298 37.5928 34.7163 29.7981 46.93C15.3712 69.5352 25.2093 98.0802 51.897 112.203C61.5213 117.296 61.9477 116.601 66.2719 118.393C69.9225 119.906 84.5902 122.741 83.3406 118.81C81.6658 113.541 67.4348 107.761 75.523 101.208L75.5232 101.208Z"
                            fill="#F4821F"
                            fillOpacity={0.99}
                        />
                        <Path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M142.242 144.531C131.816 136.117 115.902 106.089 96.3664 89.4959C95.8096 89.0228 95.5498 88.3117 103.811 83.9826C109.954 80.7636 112.6 80.3128 114.318 80.1458C120.151 79.579 123.166 88.8979 130.343 96.0688C134.451 100.174 137.153 98.8286 141.379 92.2456C156.221 69.1249 145.223 40.5553 123.603 27.4187C101.019 13.6967 79.9493 15.3754 59.2863 22.3981C51.5632 25.0229 51.3032 26.349 50.4314 25.2234C41.3561 13.5058 40.7604 13.8251 40.0805 12.7571C39.538 11.905 52.0876 6.56428 56.1498 5.22571C118.397 -15.2868 181.111 27.8939 169.631 77.2129C166.405 91.07 159.236 99.9239 156.957 103.115C151.739 110.422 147.173 112.387 147.761 115.918C148.684 121.467 169.356 134.071 158.54 139.625C152.487 142.733 146.901 148.209 142.242 144.531Z"
                            fill="#F4821F"
                            fillOpacity={0.99}
                        />
                    </Svg>
                </Animated.View>

                {/* Text (QUIBLE) */}
                <Animated.View style={[styles.textWrapper, textAnimatedStyle]}>
                    <Svg
                        width={400 * LOGO_SCALE}
                        height={100 * LOGO_SCALE}
                        viewBox="180 30 400 100"
                        fill="none"
                    >
                        <Path
                            d="M221.432 125.536C208.717 125.536 198.776 121.995 191.608 114.912C184.44 107.829 180.856 97.7173 180.856 84.576V34.4H201.592V83.808C201.592 92.3413 203.341 98.4853 206.84 102.24C210.339 105.995 215.245 107.872 221.56 107.872C227.875 107.872 232.781 105.995 236.28 102.24C239.779 98.4853 241.528 92.3413 241.528 83.808V34.4H262.008V84.576C262.008 97.7173 258.424 107.829 251.256 114.912C244.088 121.995 234.147 125.536 221.432 125.536ZM282.499 124V34.4H303.235V124H282.499ZM324.499 124V34.4H368.275C379.539 34.4 387.987 36.5333 393.619 40.8C399.336 45.0667 402.195 50.6987 402.195 57.696C402.195 62.3893 401.043 66.4853 398.739 69.984C396.435 73.3973 393.278 76.0427 389.267 77.92C385.256 79.7973 380.648 80.736 375.443 80.736L377.875 75.488C383.507 75.488 388.499 76.4267 392.851 78.304C397.203 80.096 400.574 82.784 402.963 86.368C405.438 89.952 406.675 94.3467 406.675 99.552C406.675 107.232 403.646 113.248 397.587 117.6C391.528 121.867 382.611 124 370.835 124H324.499ZM345.107 108.384H369.299C374.675 108.384 378.728 107.531 381.459 105.824C384.275 104.032 385.683 101.216 385.683 97.376C385.683 93.6213 384.275 90.848 381.459 89.056C378.728 87.1787 374.675 86.24 369.299 86.24H343.571V71.136H365.715C370.75 71.136 374.59 70.2827 377.235 68.576C379.966 66.784 381.331 64.096 381.331 60.512C381.331 57.0133 379.966 54.4107 377.235 52.704C374.59 50.912 370.75 50.016 365.715 50.016H345.107V108.384ZM422.374 124V34.4H443.11V107.104H488.038V124H422.374ZM518.696 70.496H561.832V86.624H518.696V70.496ZM520.232 107.36H569V124H499.624V34.4H567.336V51.04H520.232V107.36Z"
                            fill="#F27C22"
                        />
                    </Svg>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    speedLinesContainer: {
        position: 'absolute',
        left: '10%',
        top: '48%',
        flexDirection: 'column',
        gap: 8,
    },
    speedLine: {
        height: 3,
        backgroundColor: '#F4821F',
        borderRadius: 2,
    },
    speedLine1: {
        width: 60,
        marginLeft: -20,
    },
    speedLine2: {
        width: 80,
        marginLeft: -40,
    },
    speedLine3: {
        width: 50,
        marginLeft: -10,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        marginRight: 5 * LOGO_SCALE,
    },
    textWrapper: {
        // Positioned next to icon
    },
});
