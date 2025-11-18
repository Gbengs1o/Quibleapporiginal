
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserData {
    id: number;
    name: string;
    email: string;
    phone: string;
}

export const useAuth = () => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const storedUserData = await AsyncStorage.getItem('userData');
                if (storedUserData) {
                    setUserData(JSON.parse(storedUserData));
                }
            } catch (error) {
                console.error('Failed to load user data from storage', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, []);

    const signup = async (userData: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });
            const data = await response.json();
            if (response.ok) {
                await AsyncStorage.setItem('userData', JSON.stringify(data));
                setUserData(data);
                return { success: true, data };
            } else {
                return { success: false, message: data.message || 'Something went wrong' };
            }
        } catch (error) {
            return { success: false, message: 'An unexpected error occurred' };
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (credentials: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            const data = await response.json();
            if (response.ok) {
                await AsyncStorage.setItem('accessToken', data.access_token);
                const userResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${data.access_token}`
                    }
                });
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    await AsyncStorage.setItem('userData', JSON.stringify(userData));
                    setUserData(userData);
                    return { success: true };
                } else {
                    return { success: false, message: 'Failed to fetch user data after login' };
                }
            } else {
                return { success: false, message: data.message || 'Login failed' };
            }
        } catch (error) {
            return { success: false, message: 'An unexpected error occurred' };
        } finally {
            setIsLoading(false);
        }
    };

    const verifyEmail = async (userId: string, token: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, token }),
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true };
            } else {
                const errorMessage = Array.isArray(data.message) ? data.message.join('\n') : data.message;
                return { success: false, message: errorMessage || 'Something went wrong' };
            }
        } catch (error) {
            return { success: false, message: 'An unexpected error occurred. Please try again.' };
        } finally {
            setIsLoading(false);
        }
    };

    const resendVerificationEmail = async (userId: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/resend-verification-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            });

            if (response.ok) {
                return { success: true, message: 'A new verification code has been sent to your email.' };
            } else {
                const data = await response.json();
                const errorMessage = Array.isArray(data.message) ? data.message.join('\n') : data.message;
                return { success: false, message: errorMessage || 'Failed to resend verification code.' };
            }
        } catch (error) {
            return { success: false, message: 'An unexpected error occurred. Please try again.' };
        } finally {
            setIsLoading(false);
        }
    };

    const getAccessToken = async () => {
        try {
            return await AsyncStorage.getItem('accessToken');
        } catch (error) {
            console.error('Failed to get access token from storage', error);
            return null;
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('userData');
            await AsyncStorage.removeItem('accessToken');
            setUserData(null);
        } catch (error) {
            console.error('Failed to remove user data from storage', error);
        }
    };

    return { userData, isLoading, signup, login, verifyEmail, resendVerificationEmail, getAccessToken, logout };
};
