import QuibbleLogo from '@/components/QuibbleLogo';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RiderRegistrationLayoutProps {
    children: React.ReactNode;
    currentStep: number;
    totalSteps: number;
    title: string;
    subtitle?: string;
    onBack?: () => void;
}

export default function RiderRegistrationLayout({
    children,
    currentStep,
    totalSteps,
    title,
    subtitle,
    onBack,
}: RiderRegistrationLayoutProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const currentTheme = isDark ? Colors.dark : Colors.light; // Renamed to avoid shadowing 'theme' import

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    const progress = (currentStep / totalSteps) * 100;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0D0D1A' : '#FAFBFF' }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Header with Branding */}
            <View style={[styles.header, { backgroundColor: isDark ? '#1A1A2E' : '#fff', borderBottomColor: isDark ? '#2A2A4A' : '#E8E8FF' }]}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={[styles.backButton, { backgroundColor: isDark ? '#2A2A4A' : '#F0F2FF' }]}
                >
                    <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1F2050'} />
                </TouchableOpacity>

                {/* Branding Section */}
                <View style={styles.brandingRow}>
                    <View style={[styles.miniLogoBg, { backgroundColor: isDark ? '#2A2A5A' : '#1F205015' }]}>
                        <QuibbleLogo width={24} height={24} />
                    </View>
                    <View style={styles.riderBadgeMini}>
                        <MaterialCommunityIcons name="motorbike" size={12} color="#fff" />
                    </View>
                    <Text style={[styles.brandText, { color: isDark ? '#fff' : '#1F2050' }]}>Rider Registration</Text>
                </View>

                {/* Progress */}
                <View style={styles.progressSection}>
                    <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#2A2A4A' : '#E0E0EE' }]}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progress}%`,
                                    backgroundColor: '#F4821F'
                                }
                            ]}
                        />
                    </View>
                    <Text style={[styles.stepText, { color: isDark ? 'rgba(255,255,255,0.6)' : theme.tabIconDefault }]}>
                        Step {currentStep} of {totalSteps}
                    </Text>
                </View>
            </View>

            {/* Content Area */}
            <View style={[styles.content, { backgroundColor: isDark ? '#0D0D1A' : '#FAFBFF' }]}>
                <View style={styles.titleSection}>
                    <Text style={[styles.title, { color: isDark ? '#fff' : '#1F2050' }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : theme.tabIconDefault }]}>{subtitle}</Text>
                    )}
                </View>

                <View style={styles.childrenContainer}>
                    {children}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    brandingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    miniLogoBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    riderBadgeMini: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#F4821F',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
        marginRight: 10,
        borderWidth: 2,
        borderColor: '#fff',
    },
    brandText: {
        fontSize: 16,
        fontWeight: '700',
    },
    progressSection: {
        gap: 6,
    },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    stepText: {
        fontSize: 12,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    titleSection: {
        paddingTop: 20,
        paddingBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
    },
    childrenContainer: {
        flex: 1,
    },
});
