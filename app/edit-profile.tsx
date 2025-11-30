import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TextInput, Text, TouchableOpacity, Alert, Image, useColorScheme } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColor } from '@/hooks/use-theme-color';
import LoadingAnimation from '@/components/LoadingAnimation';

const EditProfileScreen = () => {
    const { user } = useAuth();
    const theme = useColorScheme() ?? 'light';
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [town, setTown] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureMimeType, setProfilePictureMimeType] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const inputColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const inputBgColor = useThemeColor({ light: '#fff', dark: '#333' }, 'background');
    const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'border');

    const fetchProfile = useCallback(async () => {
        if (user) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, phone_number, address, state, town, profile_picture_url')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    setFirstName(data.first_name || '');
                    setLastName(data.last_name || '');
                    setPhoneNumber(data.phone_number || '');
                    setAddress(data.address || '');
                    setState(data.state || '');
                    setTown(data.town || '');
                    setProfilePictureUrl(data.profile_picture_url || null);
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to fetch profile. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    }, [user?.id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            setProfilePictureUrl(result.assets[0].uri);
            setProfilePictureMimeType(result.assets[0].mimeType);
        }
    };

    const handleUpdate = useCallback(async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to update your profile.');
            return;
        }
    
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert('Error', 'First and last name are required.');
            return;
        }

        setIsSaving(true);

        try {
            let publicUrl = profilePictureUrl;

            if (profilePictureUrl && !profilePictureUrl.startsWith('https')) {
                const arraybuffer = await fetch(profilePictureUrl).then((res) => res.arrayBuffer());

                const fileExt = profilePictureUrl.split('.').pop()?.toLowerCase() ?? 'jpeg';
                const path = `${user.id}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('profile-pictures')
                    .upload(path, arraybuffer, {
                        contentType: profilePictureMimeType ?? `image/${fileExt}`,
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
                publicUrl = data.publicUrl;
            }

            const { error } = await supabase
                .from('profiles')
                .update({ 
                    first_name: firstName, 
                    last_name: lastName, 
                    phone_number: phoneNumber, 
                    address,
                    state,
                    town,
                    profile_picture_url: publicUrl
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully.');
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [firstName, lastName, user, phoneNumber, address, state, town, profilePictureUrl, profilePictureMimeType]);

    if (loading) {
        return <LoadingAnimation />;
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>Edit Profile</ThemedText>
            
            <View style={styles.profilePictureContainer}>
                <Image source={{ uri: profilePictureUrl || 'https://placehold.co/400' }} style={styles.profilePicture} />
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                    <Text style={styles.uploadButtonText}>Upload</Text>
                </TouchableOpacity>
            </View>

            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={user?.email} editable={false} placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={firstName} onChangeText={setFirstName} placeholder="First Name" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={lastName} onChangeText={setLastName} placeholder="Last Name" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Phone Number" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={state} onChangeText={setState} placeholder="State" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />
            <TextInput style={[styles.input, { color: inputColor, backgroundColor: inputBgColor, borderColor }]} value={town} onChangeText={setTown} placeholder="Town" placeholderTextColor={theme === 'dark' ? '#888' : '#999'} />

            <TouchableOpacity style={styles.saveButton} onPress={handleUpdate} disabled={isSaving}>
                {isSaving ? <LoadingAnimation /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { textAlign: 'center', marginBottom: 20 },
    profilePictureContainer: { alignItems: 'center', marginBottom: 20 },
    profilePicture: { width: 100, height: 100, borderRadius: 50 },
    uploadButton: { backgroundColor: '#1F2050', padding: 10, borderRadius: 5, marginTop: 10 },
    uploadButtonText: { color: '#fff' },
    input: { borderWidth: 1, borderRadius: 5, padding: 10, fontSize: 16, marginBottom: 10 },
    saveButton: { backgroundColor: '#1F2050', borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default EditProfileScreen;
