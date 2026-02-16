import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Brand colors
const BRAND_NAVY = '#1F2050';
const BRAND_ORANGE = '#f27c22';

const onboardingData = [
    {
        id: '1',
        image: require('../assets/images/onboarding/onboarding_welcome_v2.jpg'),
        title: 'Welcome to Quible!',
        description: 'Your favorite food, delivered fast. Experience the easiest way to order meals from local restaurants.',
    },
    {
        id: '2',
        image: require('../assets/images/onboarding/onboarding_restaurants_v2.jpg'),
        title: 'Explore Diverse Cuisines',
        description: 'From local favorites to international delights, discover a world of flavors at your fingertips.',
    },
    {
        id: '3',
        image: require('../assets/images/onboarding/onboarding_tracking_v2.jpg'),
        title: 'Real-Time Tracking',
        description: 'Watch your order journey from kitchen to doorstep with live GPS tracking.',
    },
    {
        id: '4',
        image: require('../assets/images/onboarding/onboarding_payment_v2.jpg'),
        title: 'Easy & Secure Payments',
        description: 'Multiple payment options with bank-grade security. Pay your way, worry-free.',
    },
    {
        id: '5',
        image: require('../assets/images/onboarding/onboarding_rider_v2.jpg'),
        title: 'Become a Quible Rider',
        description: 'Turn your spare time into earnings. Join our delivery team and be your own boss.',
    },
];

const OnboardingScreen = () => {
    const router = useRouter();
    const { session } = useAuth();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [currentIndex, setCurrentIndex] = useState(0);
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';

    // Theme Colors
    const backgroundColor = useThemeColor({ light: '#FFFFFF', dark: '#000000' }, 'background');
    const textColor = useThemeColor({ light: '#1F2050', dark: '#FFFFFF' }, 'text');
    const descriptionColor = useThemeColor({ light: '#666666', dark: '#AAAAAA' }, 'text');

    const handleNext = () => {
        if (currentIndex < onboardingData.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            router.replace('/(auth)/login');
        }
    };

    const handleSkip = () => {
        router.replace('/(auth)/login');
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    // Redirect if authenticated
    if (session) {
        return <Redirect href="/(tabs)/Home" />;
    }

    const renderItem = ({ item, index }: { item: typeof onboardingData[0]; index: number }) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

        const imageScale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
        });

        const imageOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp',
        });

        const textTranslateY = scrollX.interpolate({
            inputRange,
            outputRange: [50, 0, 50],
            extrapolate: 'clamp',
        });

        const textOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
        });

        return (
            <View style={[styles.slide, { width, height }]}>
                <View style={styles.contentContainer}>
                    {/* Image Container */}
                    <Animated.View
                        style={[
                            styles.imageContainer,
                            {
                                transform: [{ scale: imageScale }],
                                opacity: imageOpacity,
                            },
                        ]}
                    >
                        <Image source={item.image} style={styles.image} />
                    </Animated.View>

                    {/* Text Content */}
                    <Animated.View
                        style={[
                            styles.textContainer,
                            {
                                transform: [{ translateY: textTranslateY }],
                                opacity: textOpacity,
                            },
                        ]}
                    >
                        <ThemedText style={[styles.title, { color: textColor }]}>{item.title}</ThemedText>
                        <ThemedText style={[styles.description, { color: descriptionColor }]}>{item.description}</ThemedText>
                    </Animated.View>
                </View>
            </View>
        );
    };

    // Animated Dot Indicator
    const Paginator = () => {
        return (
            <View style={styles.paginationContainer}>
                {onboardingData.map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

                    const dotScale = scrollX.interpolate({
                        inputRange,
                        outputRange: [1, 2.5, 1],
                        extrapolate: 'clamp',
                    });

                    const dotOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.4, 1, 0.4],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={i.toString()}
                            style={[
                                styles.dot,
                                {
                                    transform: [{ scaleX: dotScale }],
                                    opacity: dotOpacity,
                                    backgroundColor: i === currentIndex ? BRAND_ORANGE : (isDark ? '#444' : '#CCC'),
                                    width: 10, // Explicit width for base
                                },
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                translucent
                backgroundColor="transparent"
            />

            {/* Skip Button */}
            <TouchableOpacity
                style={[
                    styles.skipButton,
                    {
                        top: insets.top + 10,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)'
                    }
                ]}
                onPress={handleSkip}
                activeOpacity={0.7}
            >
                <ThemedText style={[styles.skipText, { color: descriptionColor }]}>Skip</ThemedText>
            </TouchableOpacity>

            {/* Main Content */}
            <Animated.FlatList
                ref={flatListRef}
                data={onboardingData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            {/* Bottom Controls */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
                <Paginator />

                {/* Get Started Button (Only on last slide) */}
                {currentIndex === onboardingData.length - 1 && (
                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={handleNext}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={[BRAND_NAVY, BRAND_ORANGE]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.nextButtonGradient}
                        >
                            <ThemedText style={styles.nextButtonText}>Get Started</ThemedText>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    slide: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 100, // Space for bottom controls
        paddingTop: 80, // Prevent overlap with skip button
    },
    imageContainer: {
        width: width * 0.8,
        height: width * 0.8,
        marginBottom: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: 'OpenSans_700Bold',
        letterSpacing: -0.5,
        lineHeight: 36, // Fix for text clipping on Android
        paddingVertical: 5, // Fix for top/bottom clipping
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        fontFamily: 'OpenSans_400Regular',
    },
    skipButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    paginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    dot: {
        height: 10,
        borderRadius: 5,
        marginHorizontal: 5,
    },
    nextButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: BRAND_ORANGE,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    nextButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default OnboardingScreen;
