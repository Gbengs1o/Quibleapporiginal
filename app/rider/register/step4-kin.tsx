import RiderRegistrationLayout from '@/components/RiderRegistrationLayout';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import { readAsStringAsync } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRiderRegistration } from './_context';

export default function Step4Kin() {
    const router = useRouter();
    const { session } = useAuth();
    const { formData, updateFormData } = useRiderRegistration();
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const [submitting, setSubmitting] = useState(false);

    // Helper to upload a single file
    const uploadFile = async (uri: string, path: string) => {
        if (!uri) return null;

        try {
            const base64 = await readAsStringAsync(uri, {
                encoding: 'base64',
            });
            const fileData = decode(base64);
            const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${path}.${ext}`;

            const { data, error } = await supabase.storage
                .from('rider-documents')
                .upload(`${session?.user.id}/${fileName}`, fileData, {
                    upsert: true,
                    contentType: 'image/jpeg',
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('rider-documents')
                .getPublicUrl(`${session?.user.id}/${fileName}`);

            return publicUrl;
        } catch (e) {
            console.error('Upload Error', e);
            throw e; // Rethrow to stop submission if upload fails
        }
    };

    const handleSubmit = async () => {
        if (!formData.kinName || !formData.kinPhone || !formData.kinRelationship) {
            Alert.alert('Required', 'Please fill in all Next of Kin details.');
            return;
        }

        setSubmitting(true);

        try {
            // 1. Upload Images
            const riderPhotoUrl = await uploadFile(formData.riderPhoto!, 'profile_photo');
            const docIdUrl = await uploadFile(formData.docIdCard!, 'id_card');
            const docVehicleUrl = await uploadFile(formData.docVehiclePhoto!, 'vehicle_photo');
            const docLicenseFrontUrl = formData.docLicenseFront ? await uploadFile(formData.docLicenseFront, 'license_front') : null;
            const docLicenseBackUrl = formData.docLicenseBack ? await uploadFile(formData.docLicenseBack, 'license_back') : null;

            // 2. Create Rider Record
            const { error } = await supabase
                .from('riders')
                .insert({
                    user_id: session?.user.id,
                    status: 'pending', // Awaiting Admin Approval
                    rider_photo: riderPhotoUrl,
                    home_address: formData.homeAddress, // Added home address

                    vehicle_type: formData.vehicleType,
                    vehicle_brand: formData.vehicleBrand,
                    vehicle_plate: formData.vehiclePlate,

                    license_number: formData.licenseNumber,

                    next_of_kin_name: formData.kinName,
                    next_of_kin_phone: formData.kinPhone,
                    next_of_kin_relationship: formData.kinRelationship,

                    contact_phone: formData.phone, // Saving the rider's registration phone

                    documents: {
                        id_card: docIdUrl,
                        vehicle_photo: docVehicleUrl,
                        license_front: docLicenseFrontUrl,
                        license_back: docLicenseBackUrl,
                    }
                });

            if (error) throw error;

            // 3. Success!
            Alert.alert(
                'Registration Complete',
                'Your application has been submitted and is pending approval. We will notify you once verified.',
                [
                    {
                        text: 'Go to Dashboard',
                        onPress: () => router.replace('/rider/(dashboard)')
                    }
                ]
            );

        } catch (error: any) {
            console.error(error);
            Alert.alert('Registration Failed', error.message || 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <RiderRegistrationLayout
            currentStep={4}
            totalSteps={4}
            title="Next of Kin"
            subtitle="Who should we contact in case of an emergency?"
        >
            <ScrollView showsVerticalScrollIndicator={false}>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: isDark ? '#1A1A2E' : '#fff',
                            color: isDark ? '#fff' : '#1F2050',
                            borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                        }]}
                        placeholder="Name of contact"
                        placeholderTextColor="#999"
                        value={formData.kinName}
                        onChangeText={(text) => updateFormData({ kinName: text })}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Relationship</Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: isDark ? '#1A1A2E' : '#fff',
                            color: isDark ? '#fff' : '#1F2050',
                            borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                        }]}
                        placeholder="e.g. Spouse, Parent, Sibling"
                        placeholderTextColor="#999"
                        value={formData.kinRelationship}
                        onChangeText={(text) => updateFormData({ kinRelationship: text })}
                    />
                </View>

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
                        value={formData.kinPhone}
                        onChangeText={(text) => updateFormData({ kinPhone: text })}
                    />
                </View>

                {/* Disclaimer / Terms could go here */}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#1F2050', opacity: submitting ? 0.7 : 1 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text style={styles.buttonText}>Submit Application</Text>
                            <Ionicons name="checkmark-circle-outline" size={24} color="white" />
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </RiderRegistrationLayout>
    );
}

const styles = StyleSheet.create({
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
    button: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 20,
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
