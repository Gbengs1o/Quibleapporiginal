
import { supabase } from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext<{ session: Session | null; user: User | null, signOut: () => void, isReady: boolean }>({ session: null, user: null, signOut: () => {}, isReady: false });

export const AuthProvider = ({ children }: any) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null)
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Initial session loaded:', session ? 'User logged in' : 'No session');
            setSession(session);
            setUser(session?.user ?? null);
            setIsReady(true);
        }).catch((error) => {
            console.error('Error getting session:', error);
            setIsReady(true); // Set ready even on error
        });

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

    const signOut = () => {
        supabase.auth.signOut();
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
