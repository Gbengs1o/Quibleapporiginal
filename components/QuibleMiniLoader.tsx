import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

interface Props {
    size?: number;
}

export default function QuibleMiniLoader({ size = 80 }: Props) {
    const scale = size / 170;

    const floatY = useSharedValue(0);
    const rotate = useSharedValue(-5);

    useEffect(() => {
        // Continuous gentle floating
        floatY.value = withRepeat(
            withSequence(
                withTiming(-10, { duration: 1200 }),
                withTiming(0, { duration: 1200 })
            ),
            -1, // Infinite
            true
        );

        // Gentle rocking motion
        rotate.value = withRepeat(
            withSequence(
                withTiming(5, { duration: 1000 }),
                withTiming(-5, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: floatY.value },
            { rotate: `${rotate.value}deg` },
        ],
    }));

    return (
        <View style={styles.container}>
            <Animated.View style={animatedStyle}>
                <Svg
                    width={170 * scale}
                    height={156 * scale}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
