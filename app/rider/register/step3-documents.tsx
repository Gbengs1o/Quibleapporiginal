import DocumentUploader from '@/components/DocumentUploader';
import RiderRegistrationLayout from '@/components/RiderRegistrationLayout';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRiderRegistration } from './_context';

export default function Step3Documents() {
    const router = useRouter();
    const { formData, updateFormData } = useRiderRegistration();
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const handleNext = () => {
        // Only validate that ID is present for everyone
        if (!formData.docIdCard) {
            Alert.alert('Required', 'Please upload a photo of your ID Card.');
            return;
        }

        // For motor vehicles, enforce license and vehicle photo
        if (formData.vehicleType !== 'bicycle') {
            if (!formData.docLicenseFront || !formData.docLicenseBack) {
                Alert.alert('Required', 'Please upload both front and back of your Driver\'s License.');
                return;
            }
        }

        // Vehicle photo required for all
        if (!formData.docVehiclePhoto) {
            Alert.alert('Required', 'Please upload a clear photo of your vehicle.');
            return;
        }

        router.push('/rider/register/step4-kin');
    };

    return (
        <RiderRegistrationLayout
            currentStep={3}
            totalSteps={4}
            title="Documents"
            subtitle="Upload clear photos of your documents."
        >
            <ScrollView showsVerticalScrollIndicator={false}>

                <DocumentUploader
                    label="Government ID Card"
                    description="Passport, National ID, or Voter's Card."
                    imageUri={formData.docIdCard}
                    onImageSelected={(uri) => updateFormData({ docIdCard: uri })}
                />

                {formData.vehicleType !== 'bicycle' && (
                    <>
                        <DocumentUploader
                            label="License Front"
                            imageUri={formData.docLicenseFront}
                            onImageSelected={(uri) => updateFormData({ docLicenseFront: uri })}
                        />

                        <DocumentUploader
                            label="License Back"
                            imageUri={formData.docLicenseBack}
                            onImageSelected={(uri) => updateFormData({ docLicenseBack: uri })}
                        />
                    </>
                )}

                <DocumentUploader
                    label="Vehicle Photo"
                    description="A clear photo of the entire vehicle."
                    imageUri={formData.docVehiclePhoto}
                    onImageSelected={(uri) => updateFormData({ docVehiclePhoto: uri })}
                />

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
