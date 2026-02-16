import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DocumentUploaderProps {
    label: string;
    imageUri: string | null;
    onImageSelected: (uri: string) => void;
    description?: string;
    maxSizeMB?: number;
}

export default function DocumentUploader({
    label,
    imageUri,
    onImageSelected,
    description,
}: DocumentUploaderProps) {
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false, // Documents shouldn't be cropped usually
                quality: 0.8,
            });

            if (!result.canceled) {
                onImageSelected(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const removeImage = () => {
        // We can't really "remove" from here without parent clearing it, but we can re-pick
        Alert.alert('Change Image', 'Do you want to choose a different image?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes', onPress: pickImage }
        ]);
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            {description && <Text style={[styles.description, { color: theme.tabIconDefault }]}>{description}</Text>}

            <TouchableOpacity
                style={[
                    styles.uploadBox,
                    {
                        backgroundColor: isDark ? '#1A1A2E' : '#F8F9FF',
                        borderColor: isDark ? '#2A2A4A' : '#E8E8FF',
                        borderStyle: imageUri ? 'solid' : 'dashed',
                    }
                ]}
                onPress={imageUri ? removeImage : pickImage}
            >
                {imageUri ? (
                    <>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                        <View style={styles.checkBadge}>
                            <Ionicons name="checkmark-circle" size={28} color={'#F4821F'} />
                        </View>
                    </>
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="cloud-upload-outline" size={32} color={theme.tabIconDefault} />
                        <Text style={[styles.uploadText, { color: theme.tabIconDefault }]}>Tap to Upload</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 5,
    },
    description: {
        fontSize: 13,
        marginBottom: 10,
        lineHeight: 18,
    },
    uploadBox: {
        height: 150,
        borderWidth: 1.5,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
        gap: 8,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '500',
    },
    checkBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'white',
        borderRadius: 14,
    },
});
