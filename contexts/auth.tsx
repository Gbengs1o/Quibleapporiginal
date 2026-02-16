
import { supabase } from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext<{ session: Session | null; user: User | null, signOut: () => void, isReady: boolean }>({ session: null, user: null, signOut: () => { }, isReady: false });

export const AuthProvider = ({ children }: any) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null)
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                // Check if session is expired or close to expiring (less than 1 min left)
                const isExpired = session?.expires_at ? (session.expires_at * 1000) < (Date.now() + 60000) : false;

                if (session && isExpired) {
                    console.log('Session expired, refreshing...');
                    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
                    if (!refreshError && refreshedSession) {
                        setSession(refreshedSession);
                        setUser(refreshedSession.user);
                    }
                } else {
                    setSession(session);
                    setUser(session?.user ?? null);
                }
            } catch (error) {
                console.error('Error getting session:', error);
            } finally {
                setIsReady(true);
            }
        };

        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('Auth state changed:', _event);
            setSession(session);
            setUser(session?.user ?? null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        setIsReady(false);
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            setSession(null);
            setUser(null);
            setIsReady(true);
        }
    }

    return (
        <AuthContext.Provider value={{ session, user, signOut, isReady }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext);
}
