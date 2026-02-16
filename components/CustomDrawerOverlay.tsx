import { useRestaurantMenu } from '@/contexts/restaurant-menu';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import RestaurantSidebar from './RestaurantSidebar';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

const CustomDrawerOverlay = () => {
    const { isOpen, closeMenu } = useRestaurantMenu();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isOpen) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isOpen]);

    if (!isOpen) {
        // We rely on the Modal's visible prop controlled by isOpen
        // to handle the unmounting/hiding effectively.
    }

    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="none"
            onRequestClose={closeMenu}
            statusBarTranslucent
        >
            <View style={styles.overlayContainer}>
                {/* Backdrop - dims the screen */}
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </TouchableWithoutFeedback>

                {/* Sidebar - slides in */}
                <Animated.View
                    style={[
                        styles.drawerContainer,
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <RestaurantSidebar />
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawerContainer: {
        width: '80%',
        height: '100%',
        backgroundColor: '#fff',
        shadowColor: "#000",
        shadowOffset: {
            width: 2,
            height: 0,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});

export default CustomDrawerOverlay;
