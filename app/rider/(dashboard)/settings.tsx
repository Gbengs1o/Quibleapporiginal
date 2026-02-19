import RiderLoader from '@/components/RiderLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth';
import { useRiderMenu } from '@/contexts/rider-menu';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function RiderSettings() {
    // const router = useRouter();
    const { session, user } = useAuth();
    const { openMenu } = useRiderMenu();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const iconColor = isDark ? '#fff' : '#1F2050';
    const bg = isDark ? '#121212' : '#F8F9FC';
    const cardBg = isDark ? '#1E1E1E' : '#fff';
    const textColor = isDark ? '#fff' : '#1F2050';
    const primary = '#F27C22';
    const navy = isDark ? '#fff' : '#1F2050';

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [rider, setRider] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone_number: '',
        address: '',
        vehicle_brand: '',
        vehicle_plate: '',
        vehicle_type: '',
        license_number: '',
        license_expiry: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        next_of_kin_relationship: '',
        rider_photo: '',
        contact_phone: '',
        home_address: '',
    });

    useEffect(() => {
        if (session?.user.id) {
            fetchData();
        }
    }, [session?.user.id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [profileRes, riderRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', session?.user.id).single(),
                supabase.from('riders').select('*').eq('user_id', session?.user.id).single()
            ]);

            if (profileRes.data) {
                setProfile(profileRes.data);
                setFormData(prev => ({
                    ...prev,
                    first_name: profileRes.data.first_name || '',
                    last_name: profileRes.data.last_name || '',
                    phone_number: profileRes.data.phone_number || '',
                    address: profileRes.data.address || '',
                }));
            }

            if (riderRes.data) {
                setRider(riderRes.data);
                setFormData(prev => ({
                    ...prev,
                    vehicle_brand: riderRes.data.vehicle_brand || '',
                    vehicle_plate: riderRes.data.vehicle_plate || '',
                    vehicle_type: riderRes.data.vehicle_type || '',
                    license_number: riderRes.data.license_number || '',
                    license_expiry: riderRes.data.license_expiry || '',
                    next_of_kin_name: riderRes.data.next_of_kin_name || '',
                    next_of_kin_phone: riderRes.data.next_of_kin_phone || '',
                    next_of_kin_relationship: riderRes.data.next_of_kin_relationship || '',
                    rider_photo: riderRes.data.rider_photo || profileRes.data?.profile_picture_url || '',
                    contact_phone: riderRes.data.contact_phone || '',
                    home_address: riderRes.data.home_address || '',
                }));
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // 1. Update Profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone_number: formData.phone_number,
                    address: formData.address,
                })
                .eq('id', session?.user.id);

            if (profileError) throw profileError;

            // 2. Update Riders
            const { error: riderError } = await supabase
                .from('riders')
                .update({
                    vehicle_brand: formData.vehicle_brand,
                    vehicle_plate: formData.vehicle_plate,
                    vehicle_type: formData.vehicle_type,
                    license_number: formData.license_number,
                    license_expiry: formData.license_expiry || null,
                    next_of_kin_name: formData.next_of_kin_name,
                    next_of_kin_phone: formData.next_of_kin_phone,
                    next_of_kin_relationship: formData.next_of_kin_relationship,
                    rider_photo: formData.rider_photo,
                    contact_phone: formData.contact_phone,
                    home_address: formData.home_address,
                })
                .eq('user_id', session?.user.id);

            if (riderError) throw riderError;

            Alert.alert('Success', 'Profile updated successfully!');
            setIsEditing(false);
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        if (!isEditing) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled) {
                setFormData(prev => ({ ...prev, rider_photo: result.assets[0].uri }));
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    if (loading) return <RiderLoader message="Fetching profile details..." />;

    const renderInput = (label: string, field: string, icon: string, placeholder: string) => (
        <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
                <Ionicons name={icon as any} size={16} color={primary} />
                <ThemedText style={styles.label}>{label}</ThemedText>
            </View>
            {isEditing ? (
                <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    value={(formData as any)[field]}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                />
            ) : (
                <ThemedText style={[styles.valueText, { color: textColor }]}>
                    {(formData as any)[field] || `No ${label.toLowerCase()} set`}
                </ThemedText>
            )}
        </View>
    );

    const renderActionRow = (label: string, icon: string, color: string, onPress: () => void) => (
        <TouchableOpacity style={styles.actionRow} onPress={onPress}>
            <View style={styles.labelRow}>
                <Ionicons name={icon as any} size={20} color={color} />
                <ThemedText style={[styles.themeLabel, { color: textColor }]}>{label}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor: bg }]}>
            <View style={[styles.header, { backgroundColor: cardBg }]}>
                <TouchableOpacity onPress={openMenu} style={[styles.menuBtn, isDark && styles.menuBtnDark]}>
                    <Ionicons name="menu" size={28} color={navy} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: textColor }]}>Profile & Settings</ThemedText>
                <TouchableOpacity
                    onPress={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={primary} />
                    ) : (
                        <ThemedText style={[styles.editBtn, { color: primary }]}>
                            {isEditing ? 'Save' : 'Edit'}
                        </ThemedText>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Profile Photo */}
                <View style={styles.photoSection}>
                    <TouchableOpacity
                        onPress={pickImage}
                        style={[styles.photoContainer, isEditing && styles.photoEditBorder, isDark && { backgroundColor: '#333' }]}
                        disabled={!isEditing}
                    >
                        {formData.rider_photo ? (
                            <Image source={{ uri: formData.rider_photo }} style={styles.profilePhoto} />
                        ) : (
                            <View style={[styles.photoPlaceholder, isDark && { backgroundColor: '#333' }]}>
                                <Ionicons name="person" size={40} color="#ccc" />
                            </View>
                        )}
                        {isEditing && (
                            <View style={styles.photoBadge}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <ThemedText style={[styles.userName, { color: textColor }]}>
                        {formData.first_name} {formData.last_name}
                    </ThemedText>
                    <ThemedText style={[styles.userEmail, isDark && { color: '#999' }]}>{user?.email}</ThemedText>
                </View>

                {/* Personal Info */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Personal Information</ThemedText>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {renderInput('First Name', 'first_name', 'person-outline', 'Enter first name')}
                        {renderInput('Last Name', 'last_name', 'person-outline', 'Enter last name')}
                        {renderInput('Profile Phone', 'phone_number', 'call-outline', 'Enter phone number')}
                        {renderInput('Rider Contact', 'contact_phone', 'call-outline', 'Enter contact phone')}
                        {renderInput('Profile Address', 'address', 'location-outline', 'Enter address')}
                        {renderInput('Home Address', 'home_address', 'home-outline', 'Enter home address')}
                    </View>
                </View>

                {/* Vehicle Info */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Vehicle Details</ThemedText>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {renderInput('Vehicle Brand', 'vehicle_brand', 'car-outline', 'e.g. Toyota, Bajaj')}
                        {renderInput('Plate Number', 'vehicle_plate', 'card-outline', 'e.g. ABC-123')}
                        {renderInput('Vehicle Type', 'vehicle_type', 'bicycle-outline', 'e.g. Car, Motorcycle')}
                        {renderInput('License Number', 'license_number', 'document-text-outline', 'Enter license number')}
                        {renderInput('License Expiry', 'license_expiry', 'calendar-outline', 'YYYY-MM-DD')}
                    </View>
                </View>

                {/* Emergency Contact */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Next of Kin</ThemedText>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {renderInput('Full Name', 'next_of_kin_name', 'people-outline', 'Enter kin name')}
                        {renderInput('Phone Number', 'next_of_kin_phone', 'call-outline', 'Enter kin phone')}
                        {renderInput('Relationship', 'next_of_kin_relationship', 'heart-outline', 'e.g. Spouse, Brother')}
                    </View>
                </View>

                {/* Account Actions */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Display & Account</ThemedText>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.themeRow}>
                            <View style={styles.labelRow}>
                                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={primary} />
                                <ThemedText style={[styles.themeLabel, { color: textColor }]}>Dark Mode</ThemedText>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#ccc', true: primary }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#eee', marginVertical: 12 }]} />

                        <TouchableOpacity style={styles.logoutRow} onPress={() => {
                            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut().then(() => router.replace('/')) }
                            ]);
                        }}>
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            <ThemedText style={styles.logoutBtnText}>Sign Out</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Help & Support */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Help & Support</ThemedText>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {renderActionRow('Contact Support', 'help-circle-outline', primary, () => router.push('/(tabs)/Support'))}
                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#eee', marginVertical: 8 }]} />
                        {renderActionRow('Privacy Policy', 'shield-checkmark-outline', '#4CAF50', () => { })}
                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#eee', marginVertical: 8 }]} />
                        {renderActionRow('Terms of Service', 'document-text-outline', '#2196F3', () => { })}
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                        setIsEditing(false);
                        fetchData(); // Reset data
                    }}>
                        <ThemedText style={styles.cancelText}>Cancel Changes</ThemedText>
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    menuBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuBtnDark: {
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#333',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    editBtn: {
        fontSize: 16,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 20,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    photoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E1E1E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        overflow: 'hidden',
    },
    photoEditBorder: {
        borderWidth: 2,
        borderColor: '#F27C22',
    },
    profilePhoto: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F2FF',
    },
    photoBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#F27C22',
        padding: 6,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    inputGroup: {
        marginBottom: 15,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    label: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    valueText: {
        fontSize: 16,
        fontWeight: '500',
        paddingLeft: 22,
    },
    input: {
        backgroundColor: '#F8F9FC',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 16,
        color: '#1F2050',
        borderWidth: 1,
        borderColor: '#E8E8FF',
    },
    inputDark: {
        backgroundColor: '#333',
        color: '#fff',
        borderColor: '#444',
    },
    themeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    themeLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    divider: {
        height: 1,
    },
    cancelBtn: {
        alignItems: 'center',
        marginTop: 10,
    },
    cancelText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
    },
    logoutBtnText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});

