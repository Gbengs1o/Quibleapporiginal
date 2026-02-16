import RiderRegistrationLayout from '@/components/RiderRegistrationLayout';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRiderRegistration } from './_context';

const VEHICLE_TYPES = [
    { id: 'bike', label: 'Motorbike', icon: 'motorbike', iconType: 'material' },
    { id: 'bicycle', label: 'Bicycle', icon: 'bicycle', iconType: 'ionicons' },
    { id: 'tricycle', label: 'Tricycle (Keke)', icon: 'rickshaw', iconType: 'material' },
    { id: 'car', label: 'Car', icon: 'car-outline', iconType: 'ionicons' },
];

export default function Step2Vehicle() {
    const router = useRouter();
    const { formData, updateFormData } = useRiderRegistration();
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const handleNext = () => {
        if (!formData.vehicleBrand) {
            Alert.alert('Required', 'Please enter your vehicle brand and model.');
            return;
        }
        // Plate is not required for bicycles
        if (formData.vehicleType !== 'bicycle' && !formData.vehiclePlate) {
            Alert.alert('Required', 'Please enter your vehicle plate number.');
            return;
        }
        // License is not required for bicycles
        if (formData.vehicleType !== 'bicycle' && !formData.licenseNumber) {
            Alert.alert('Required', 'Please enter your drivers license number.');
            return;
        }
        router.push('/rider/register/step3-documents');
    };

    return (
        <RiderRegistrationLayout
            currentStep={2}
            totalSteps={4}
            title="Vehicle Information"
            subtitle="Tell us what you'll be using to deliver."
        >
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Vehicle Type Selector */}
                <Text style={[styles.label, { color: theme.text }]}>Vehicle Type</Text>
                <View style={styles.typesContainer}>
                    {VEHICLE_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type.id}
                            style={[
                                styles.typeOption,
                                {
                                    backgroundColor: formData.vehicleType === type.id
                                        ? '#F4821F'
                                        : (isDark ? '#1A1A2E' : '#F0F2FF')
                                }
                            ]}
                            onPress={() => updateFormData({ vehicleType: type.id })}
                        >
                            {type.iconType === 'material' ? (
                                <MaterialCommunityIcons
                                    name={type.icon as any}
                                    size={24}
                                    color={formData.vehicleType === type.id ? 'white' : theme.tabIconDefault}
                                />
                            ) : (
                                <Ionicons
                                    name={type.icon as any}
                                    size={24}
                                    color={formData.vehicleType === type.id ? 'white' : theme.tabIconDefault}
                                />
                            )}
                            <Text
                                style={[
                                    styles.typeLabel,
                                    {
                                        color: formData.vehicleType === type.id ? 'white' : theme.text
                                    }
                                ]}
                            >
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Input Fields */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.text }]}>Brand & Model</Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: isDark ? '#1A1A2E' : '#fff',
                            color: isDark ? '#fff' : '#1F2050',
                            borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                        }]}
                        placeholder="e.g. Honda Wave 110"
                        placeholderTextColor="#999"
                        value={formData.vehicleBrand}
                        onChangeText={(text) => updateFormData({ vehicleBrand: text })}
                    />
                </View>

                {formData.vehicleType !== 'bicycle' && (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Plate Number</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: isDark ? '#1A1A2E' : '#fff',
                                    color: isDark ? '#fff' : '#1F2050',
                                    borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                                }]}
                                placeholder="ABC 1234"
                                placeholderTextColor="#999"
                                autoCapitalize="characters"
                                value={formData.vehiclePlate}
                                onChangeText={(text) => updateFormData({ vehiclePlate: text })}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Driver's License Number</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: isDark ? '#1A1A2E' : '#fff',
                                    color: isDark ? '#fff' : '#1F2050',
                                    borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
                                }]}
                                placeholder="License Number"
                                placeholderTextColor="#999"
                                value={formData.licenseNumber}
                                onChangeText={(text) => updateFormData({ licenseNumber: text })}
                            />
                        </View>
                    </>
                )}

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
    typesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 25,
    },
    typeOption: {
        width: '48%',
        height: 70,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
    },
    typeLabel: {
        fontWeight: '600',
        fontSize: 14,
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
