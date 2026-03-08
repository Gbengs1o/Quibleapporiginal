import { supabase } from '@/utils/supabase';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
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

    const peerConnection = useRef<any>(null);
    const supabaseChannel = useRef<any>(null);
    const incomingChannel = useRef<any>(null);
    const pendingOffer = useRef<any>(null);
    const pendingIceCandidates = useRef<any[]>([]);

    const clearMedia = () => {
        if (localStream) {
            localStream.getTracks().forEach((t: any) => t.stop());
        }
        setLocalStream(null);
        setRemoteStream(null);
    };

    const clearConnection = () => {
        if (peerConnection.current) {
            try {
                peerConnection.current.close();
            } catch (_) {
                // ignore close errors on stale connection
            }
            peerConnection.current = null;
        }
    };

    const clearOutgoingChannel = () => {
        if (supabaseChannel.current) {
            supabase.removeChannel(supabaseChannel.current);
            supabaseChannel.current = null;
        }
    };

    const clearState = () => {
        setStatus('idle');
        setIncomingCaller(null);
        setCallerId(null);
        setActiveChannelId(null);
        pendingOffer.current = null;
        pendingIceCandidates.current = [];
    };

    const flushPendingIceCandidates = async () => {
        const pc = peerConnection.current;
        if (!pc || !pc.remoteDescription) return;

        const queue = [...pendingIceCandidates.current];
        pendingIceCandidates.current = [];

        for (const rawCandidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(rawCandidate));
            } catch (e) {
                console.log('Error flushing ICE:', e);
            }
        }
    };

    const endCallInternal = (notifyRemote: boolean) => {
        if (notifyRemote && supabaseChannel.current) {
            supabaseChannel.current.send({
                type: 'broadcast',
                event: 'end-call',
                payload: { from: user?.id },
            });
        }

        clearConnection();
        clearMedia();
        clearOutgoingChannel();
        clearState();
    };

    const ensureOutgoingChannel = async (targetChannelId: string) => {
        if (supabaseChannel.current && activeChannelId === targetChannelId) {
            return supabaseChannel.current;
        }

        clearOutgoingChannel();

        const channel = supabase.channel(targetChannelId, {
            config: { broadcast: { self: false } }
        });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Call signaling timeout')), 8000);
            channel.subscribe((channelStatus: string) => {
                if (channelStatus === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    resolve();
                } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
                    clearTimeout(timeout);
                    reject(new Error(`Call signaling failed: ${channelStatus}`));
                }
            });
        });

        supabaseChannel.current = channel;
        return channel;
    };

    // 1. Global Listener for Incoming Calls (Signaling: Receiver Side)
    useEffect(() => {
        if (!user) return;

        const myChannelId = `user-${user.id}`;
        const channel = supabase.channel(myChannelId, {
            config: { broadcast: { self: false } }
        });
        incomingChannel.current = channel;

        channel
            .on('broadcast', { event: 'offer' }, ({ payload }) => {
                const { offer, callerId: incomingCallerId } = payload;
                // Start a fresh ICE queue for the new incoming call.
                pendingIceCandidates.current = [];
                pendingOffer.current = offer || payload;
                setIncomingCaller(incomingCallerId || 'Unknown Caller');
                setCallerId(incomingCallerId);
                setStatus('incoming');
            })
            .on('broadcast', { event: 'answer' }, async ({ payload }) => {
                // If I am the caller, I receive the answer here on MY channel
                if (peerConnection.current) {
                    try {
                        const answer = payload?.answer || payload;
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                        await flushPendingIceCandidates();
                        setStatus('connected');
                    } catch (error) {
                        console.log('Error handling answer:', error);
                        endCallInternal(false);
                    }
                }
            })
            .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                try {
                    const candidate = payload?.candidate || payload;
                    if (!candidate) return;

                    const pc = peerConnection.current;
                    // If callee has not accepted yet, keep ICE for later.
                    if (!pc || !pc.remoteDescription) {
                        pendingIceCandidates.current.push(candidate);
                        return;
                    }

                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.log('Error adding ICE:', e);
                }
            })
            .on('broadcast', { event: 'end-call' }, () => {
                endCallInternal(false);
            })
            .subscribe((status) => {
                console.log(`Subscribed to my signaling channel: ${myChannelId} (${status})`);
            });

        return () => {
            if (incomingChannel.current) {
                supabase.removeChannel(incomingChannel.current);
                incomingChannel.current = null;
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
    const createPeerConnection = () => {
        const pc: any = new RTCPeerConnection(configuration);

        const remoteAudioStream = new MediaStream();

        pc.addEventListener('icecandidate', (event: any) => {
            if (event?.candidate && supabaseChannel.current) {
                supabaseChannel.current.send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: { candidate: event.candidate },
                });
            }
        });

        pc.addEventListener('track', (event: any) => {
            const stream = event?.streams?.[0];
            if (stream) {
                stream.getAudioTracks?.().forEach((track: any) => {
                    track.enabled = true;
                });
                setRemoteStream(stream);
                return;
            }
            if (event?.track) {
                event.track.enabled = true;
                remoteAudioStream.addTrack(event.track);
                setRemoteStream(remoteAudioStream);
            }
        });

        pc.addEventListener('connectionstatechange', () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                endCallInternal(false);
            }
        });

        return pc;
    };

    // 4. Start Call (Caller Side)
    const startCall = async (recipientId: string) => {
        if (!user) return;
        if (status !== 'idle') return;

        const stream = await getLocalStream();
        if (!stream) return;

        try {
            const targetChannelId = `user-${recipientId}`;
            setActiveChannelId(targetChannelId);
            setStatus('calling');

            const channel = await ensureOutgoingChannel(targetChannelId);

            const pc = createPeerConnection();
            peerConnection.current = pc;
            stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
            await pc.setLocalDescription(offer);

            await channel.send({
                type: 'broadcast',
                event: 'offer',
                payload: {
                    offer: pc.localDescription || offer,
                    callerId: user.id
                },
            });
        } catch (error: any) {
            console.log('Error starting call:', error);
            Alert.alert('Call Failed', error?.message || 'Could not start call.');
            endCallInternal(false);
        }
    };

    // 5. Accept Call (Receiver Side)
    const acceptCall = async () => {
        if (!callerId || !pendingOffer.current) return;
        const stream = await getLocalStream();
        if (!stream) return;

        try {
            const targetChannelId = `user-${callerId}`;
            setActiveChannelId(targetChannelId);

            const channel = await ensureOutgoingChannel(targetChannelId);

            const pc = createPeerConnection();
            peerConnection.current = pc;
            stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
            await flushPendingIceCandidates();
            const answer = await pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
            await pc.setLocalDescription(answer);

            await channel.send({
                type: 'broadcast',
                event: 'answer',
                payload: {
                    answer: pc.localDescription || answer,
                    callerId: user?.id
                }
            });

            pendingOffer.current = null;
            setStatus('connected');
        } catch (error: any) {
            console.log('Error accepting call:', error);
            Alert.alert('Call Failed', error?.message || 'Could not accept call.');
            endCallInternal(false);
        }
    };

    // 6. End Call
    const endCall = () => {
        endCallInternal(true);
    };

    return (
        <CallContext.Provider value={{ status, localStream, remoteStream, startCall, acceptCall, endCall, incomingCaller }}>
            {children}
        </CallContext.Provider>
    );
}

export const useCall = () => useContext(CallContext);
