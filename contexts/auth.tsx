
import { supabase } from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext<{ session: Session | null; user: User | null, signOut: () => void, isReady: boolean }>({ session: null, user: null, signOut: () => {}, isReady: false });

export const AuthProvider = ({ children }: any) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null)
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsReady(true);
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
