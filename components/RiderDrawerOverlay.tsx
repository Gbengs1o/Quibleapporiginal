import { useRiderMenu } from '@/contexts/rider-menu';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import RiderSidebar from './RiderSidebar';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

const RiderDrawerOverlay = () => {
    const { isOpen, closeMenu } = useRiderMenu();
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
                    <RiderSidebar />
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

export default RiderDrawerOverlay;
