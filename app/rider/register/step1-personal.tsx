import RiderRegistrationLayout from '@/components/RiderRegistrationLayout';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRiderRegistration } from './_context';

export default function Step1Personal() {
    const router = useRouter();
    const { session, user } = useAuth();
    const { formData, updateFormData } = useRiderRegistration();
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'We need permission to access your gallery to upload a photo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                updateFormData({ riderPhoto: result.assets[0].uri });
            }
        } catch (error) {
            console.error('PickImage Error:', error);
            Alert.alert('Error', 'Failed to open image picker.');
        }
    };

    const handleNext = () => {
        if (!formData.riderPhoto) {
            Alert.alert('Photo Required', 'Please upload a clear photo of your face.');
            return;
        }
        if (!formData.phone || formData.phone.length < 5) {
            Alert.alert('Phone Required', 'Please enter a valid phone number.');
            return;
        }
        if (!formData.homeAddress) {
            Alert.alert('Address Required', 'Please enter your home address.');
            return;
        }
        router.push('/rider/register/step2-vehicle');
    };

    return (
        <RiderRegistrationLayout
            currentStep={1}
            totalSteps={4}
            title="Personal Information"
            subtitle="Let's start with your basic details and identification."
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Photo Upload */}
                <View style={styles.photoContainer}>
                    <TouchableOpacity onPress={pickImage} style={[styles.photoButton, { backgroundColor: isDark ? '#1A1A2E' : '#F0F2FF', borderWidth: 2, borderColor: isDark ? '#2A2A4A' : '#E8E8FF' }]}>
                        {formData.riderPhoto ? (
                            <Image source={{ uri: formData.riderPhoto }} style={styles.photo} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <Ionicons name="camera" size={40} color={theme.tabIconDefault} />
                                <Text style={[styles.photoText, { color: theme.tabIconDefault }]}>Upload Real Photo</Text>
                            </View>
                        )}
                        <View style={[styles.editBadge, { backgroundColor: '#F4821F' }]}>
                            <Ionicons name="pencil" size={16} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Read-only Fields */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                    <View style={[styles.inputDisabled, { backgroundColor: isDark ? '#1A1A2E' : '#F0F2FF', borderWidth: 1, borderColor: isDark ? '#2A2A4A' : '#E8E8FF' }]}>
                        {/* Fallback if profile is not yet loaded, though auth protected apps usually have it */}
                        <Text style={[styles.inputTextDisabled, { color: theme.tabIconDefault }]}>
                            {user?.email || 'User'}
                        </Text>
                    </View>
                </View>

                {/* Input Fields */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: isDark ? '#1A1A2E' : '#fff',
                            color: isDark ? '#fff' : '#1F2050',
                            borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                        }]}
                        placeholder="+1 234 567 8900"
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                        value={formData.phone}
                        onChangeText={(text) => updateFormData({ phone: text })}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Home Address</Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: isDark ? '#1A1A2E' : '#fff',
                            color: isDark ? '#fff' : '#1F2050',
                            borderColor: isDark ? '#2A2A4A' : '#E8E8FF',
                            height: 80,
                            paddingTop: 12,
                        }]}
                        placeholder="123 Main St, City..."
                        placeholderTextColor="#999"
                        multiline
                        value={formData.homeAddress}
                        onChangeText={(text) => updateFormData({ homeAddress: text })}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#1F2050' }]}
                    onPress={handleNext}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </RiderRegistrationLayout>
    );
}

const styles = StyleSheet.create({
    photoContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    photoButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
    },
    photo: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    photoPlaceholder: {
        alignItems: 'center',
    },
    photoText: {
        fontSize: 12,
        marginTop: 5,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    inputDisabled: {
        height: 50,
        borderRadius: 12,
        paddingHorizontal: 15,
        justifyContent: 'center',
    },
    inputTextDisabled: {
        fontSize: 16,
    },
    button: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
