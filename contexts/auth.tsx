
import AsyncStorage from '@/utils/AsyncStorage';
import { normalizeReferralCode, PENDING_REFERRAL_CODE_STORAGE_KEY } from '@/utils/referral';
import * as SupabaseUtils from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext<{ session: Session | null; user: User | null; profile: any | null; signOut: () => void; isReady: boolean }>({ session: null, user: null, profile: null, signOut: () => { }, isReady: false });

export const AuthProvider = ({ children }: any) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<any | null>(null);
    const [isReady, setIsReady] = useState(false);

    const maybeApplyPendingReferralCode = async (userId: string) => {
        try {
            const pendingCode = normalizeReferralCode(
                await AsyncStorage.getItem(PENDING_REFERRAL_CODE_STORAGE_KEY)
            );

            if (!pendingCode) return;

            const { data, error } = await SupabaseUtils.supabase.rpc('apply_referral_code', {
                p_referral_code: pendingCode,
            });

            if (error) {
                console.error('Error applying pending referral code:', error);
                return;
            }

            const payload = (data || {}) as { success?: boolean; message?: string };
            if (payload.success) {
                await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
                await fetchProfile(userId);
                return;
            }

            const message = String(payload.message || '').toLowerCase();
            const shouldClearPending =
                message.includes('already linked') ||
                message.includes('invalid referral code') ||
                message.includes('cannot use your own referral code') ||
                message.includes('referral code is required');

            if (shouldClearPending) {
                await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
            }
        } catch (err) {
            console.error('Unexpected error while applying pending referral code:', err);
        }
    };

    // Fetch user profile from profiles table
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await SupabaseUtils.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (!error && data) {
                setProfile(data);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    useEffect(() => {
        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session }, error } = await SupabaseUtils.supabase.auth.getSession();
                if (error) throw error;

                // Check if session is expired or close to expiring (less than 1 min left)
                const isExpired = session?.expires_at ? (session.expires_at * 1000) < (Date.now() + 60000) : false;

                if (session && isExpired) {
                    console.log('Session expired, refreshing...');
                    const { data: { session: refreshedSession }, error: refreshError } = await SupabaseUtils.supabase.auth.refreshSession();
                    if (!refreshError && refreshedSession) {
                        setSession(refreshedSession);
                        setUser(refreshedSession.user);
                        await fetchProfile(refreshedSession.user.id);
                        await maybeApplyPendingReferralCode(refreshedSession.user.id);
                    }
                } else {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        await fetchProfile(session.user.id);
                        await maybeApplyPendingReferralCode(session.user.id);
                    }
                }
            } catch (error) {
                console.error('Error getting session:', error);
            } finally {
                setIsReady(true);
            }
        };

        initSession();

        // Listen for auth changes
        const { data: { subscription } } = SupabaseUtils.supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('Auth state changed:', _event);
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
                await maybeApplyPendingReferralCode(session.user.id);
            } else {
                setProfile(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        setIsReady(false);
        try {
            await SupabaseUtils.supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            setSession(null);
            setUser(null);
            setProfile(null);
            setIsReady(true);
        }
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, signOut, isReady }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext);
}

