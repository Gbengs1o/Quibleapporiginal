import React from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const { width } = Dimensions.get('window');

const onboardingData = [
    {
        id: '1',
        image: require('../assets/images/bike.png'),
        title: 'Welcome to Quible!',
        description: 'Your favorite food, delivered fast.',
    },
    {
        id: '2',
        image: require('../assets/images/bike.png'),
        title: 'Wide selection of restaurants',
        description: 'Explore a variety of cuisines from local restaurants.',
    },
    {
        id: '3',
        image: require('../assets/images/bike.png'),
        title: 'Real-time tracking',
        description: 'Watch your food arrive on a live map.',
    },
    {
        id: '4',
        image: require('../assets/images/bike.png'),
        title: 'Easy and secure payment',
        description: 'Pay with your card or wallet.',
    },
    {
        id: '5',
        image: require('../assets/images/bike.png'),
        title: 'Become a Quible Rider',
        description: 'Earn money by delivering food.',
    },
];

const OnboardingScreen = () => {
    const router = useRouter();
    const { backgroundColor, labelColor } = useTheme();

    const renderItem = ({ item, index }) => (
        <View style={[styles.slide, { backgroundColor }]}>
            <Image source={item.image} style={styles.image} />
            <ThemedText style={[styles.title, { color: labelColor }]}>{item.title}</ThemedText>
            <ThemedText style={styles.description}>{item.description}</ThemedText>
            {index === onboardingData.length - 1 && (
                <TouchableOpacity style={styles.getStartedButton} onPress={() => router.push('/(tabs)/Home')}>
                    <Text style={styles.getStartedButtonText}>Get Started</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <FlatList
                data={onboardingData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
            />
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    slide: {
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    image: {
        width: 200,
        height: 200,
        resizeMode: 'contain',
        marginBottom: 40,
    },
    title: {
        fontSize: 24,
        fontFamily: 'OpenSans_700Bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        fontFamily: 'OpenSans_400Regular',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    getStartedButton: {
        marginTop: 40,
        backgroundColor: '#1F2050',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 30,
    },
    getStartedButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'OpenSans_700Bold',
    },
});

export default OnboardingScreen;
