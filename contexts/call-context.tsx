import { supabase } from '@/utils/supabase';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import { useAuth } from './auth';

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected';

interface CallContextType {
    status: CallStatus;
    localStream: any;
    remoteStream: any;
    startCall: (recipientId: string) => Promise<void>;
    acceptCall: () => Promise<void>;
    endCall: () => void;
    incomingCaller: string | null;
}

const CallContext = createContext<CallContextType>({} as CallContextType);

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN servers here for production reliability
    ]
};

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [status, setStatus] = useState<CallStatus>('idle');
    const [localStream, setLocalStream] = useState<any>(null);
    const [remoteStream, setRemoteStream] = useState<any>(null);
    const [incomingCaller, setIncomingCaller] = useState<string | null>(null);
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [callerId, setCallerId] = useState<string | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const supabaseChannel = useRef<any>(null);
    const incomingChannel = useRef<any>(null);

    // 1. Global Listener for Incoming Calls (Signaling: Receiver Side)
    useEffect(() => {
        if (!user) return;

        const myChannelId = `user-${user.id}`;
        const channel = supabase.channel(myChannelId);
        incomingChannel.current = channel;

        channel
            .on('broadcast', { event: 'offer' }, ({ payload }) => {
                const { offer, callerId: incomingCallerId } = payload;
                setIncomingCaller('Incoming Call...'); // In production, fetch user name via ID
                setCallerId(incomingCallerId);
                setStatus('incoming');

                // Store offer temporarily
                (window as any).pendingOffer = offer;
            })
            .on('broadcast', { event: 'answer' }, async ({ payload }) => {
                // If I am the caller, I receive the answer here on MY channel
                if (peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload));
                    setStatus('connected');
                }
            })
            .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                if (peerConnection.current) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload));
                    } catch (e) {
                        console.log('Error adding ICE:', e);
                    }
                }
            })
            .subscribe((status) => {
                console.log(`Subscribed to my signaling channel: ${myChannelId} (${status})`);
            });

        return () => {
            if (incomingChannel.current) {
                incomingChannel.current.unsubscribe();
            }
        };
    }, [user]);

    // 2. Setup Local Media
    const getLocalStream = async () => {
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: false, // Audio only for "Phase 1"
            });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Error accessing media:', error);
            Alert.alert('Permission Denied', 'Allow microphone access to make calls.');
            return null;
        }
    };

    // 3. Create WebRTC Peer Connection
    const createPeerConnection = (targetChannelId: string) => {
        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Send ICE candidate to the OTHER person's channel
                const targetChannel = supabase.channel(targetChannelId);
                targetChannel.send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: event.candidate,
                });
            }
        };

        pc.onaddstream = (event) => {
            setRemoteStream(event.stream);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall();
            }
        };

        return pc;
    };

    // 4. Start Call (Caller Side)
    const startCall = async (recipientId: string) => {
        if (!user) return;
        const stream = await getLocalStream();
        if (!stream) return;

        const targetChannelId = `user-${recipientId}`;
        setActiveChannelId(targetChannelId);
        setStatus('calling');

        // Note: active channel is just for sending the initial offer.
        // Subsequent signaling (Answer/ICE) comes to OUR channel (via useEffect).
        const channel = supabase.channel(targetChannelId);
        supabaseChannel.current = channel;

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const pc = createPeerConnection(targetChannelId);
                peerConnection.current = pc;
                pc.addStream(stream);

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // Send Offer
                await channel.send({
                    type: 'broadcast',
                    event: 'offer',
                    payload: {
                        offer,
                        callerId: user.id
                    },
                });
            }
        });
    };

    // 5. Accept Call (Receiver Side)
    const acceptCall = async () => {
        if (!callerId) return;
        const stream = await getLocalStream();
        if (!stream) return;

        // Target: The CALLER'S channel
        const targetChannelId = `user-${callerId}`;
        setActiveChannelId(targetChannelId);

        const pc = createPeerConnection(targetChannelId);
        peerConnection.current = pc;
        pc.addStream(stream);

        const offer = (window as any).pendingOffer;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setStatus('connected');

        // Send Answer back to Caller
        const channel = supabase.channel(targetChannelId);
        supabaseChannel.current = channel;

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'answer',
                    payload: answer
                });
            }
        });
    };

    // 6. End Call
    const endCall = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((t: any) => t.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setStatus('idle');
        setIncomingCaller(null);
        setCallerId(null);
        setActiveChannelId(null);

        if (supabaseChannel.current) {
            supabaseChannel.current.unsubscribe();
            supabaseChannel.current = null;
        }
    };

    return (
        <CallContext.Provider value={{ status, localStream, remoteStream, startCall, acceptCall, endCall, incomingCaller }}>
            {children}
        </CallContext.Provider>
    );
}

export const useCall = () => useContext(CallContext);
