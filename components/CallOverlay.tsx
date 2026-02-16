import { useCall } from '@/contexts/call-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';

export default function CallOverlay() {
    const { status, localStream, remoteStream, acceptCall, endCall, incomingCaller } = useCall();
    const insets = useSafeAreaInsets();

    if (status === 'idle') return null;

    if (status === 'incoming') {
        return (
            <Modal transparent animationType="slide" visible={true}>
                <View style={styles.incomingContainer}>
                    <View style={styles.incomingContent}>
                        <Ionicons name="call" size={48} color="#fff" />
                        <Text style={styles.callerName}>{incomingCaller || 'Unknown Caller'}</Text>
                        <Text style={styles.callStatus}>Incoming Call...</Text>

                        <View style={styles.incomingActions}>
                            <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={endCall}>
                                <Ionicons name="close" size={32} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={acceptCall}>
                                <Ionicons name="call" size={32} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal animationType="slide" visible={true}>
            <View style={[styles.activeContainer, { paddingTop: insets.top }]}>
                {remoteStream && (
                    <RTCView
                        streamURL={remoteStream.toURL()}
                        style={styles.remoteVideo}
                        objectFit="cover"
                    />
                )}
                {localStream && (
                    <View style={styles.localVideoContainer}>
                        <RTCView
                            streamURL={localStream.toURL()}
                            style={styles.localVideo}
                            objectFit="cover"
                            zOrder={1}
                        />
                    </View>
                )}

                <View style={styles.controls}>
                    <TouchableOpacity style={[styles.controlBtn, styles.endBtn]} onPress={endCall}>
                        <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    // Incoming Call Styles
    incomingContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    incomingContent: {
        backgroundColor: '#1f2050',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 40,
        alignItems: 'center',
    },
    callerName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 16,
    },
    callStatus: {
        color: '#ccc',
        fontSize: 16,
        marginBottom: 40,
    },
    incomingActions: {
        flexDirection: 'row',
        gap: 60,
    },
    btn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineBtn: {
        backgroundColor: '#ef4444',
    },
    acceptBtn: {
        backgroundColor: '#22c55e',
    },

    // Active Call Styles
    activeContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    remoteVideo: {
        flex: 1,
        backgroundColor: '#222',
    },
    localVideoContainer: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 100,
        height: 150,
        backgroundColor: '#333',
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#fff',
    },
    localVideo: {
        flex: 1,
    },
    controls: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    controlBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    endBtn: {
        backgroundColor: '#ef4444',
    },
});
