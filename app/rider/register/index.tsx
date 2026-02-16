import QuibbleLogo from '@/components/QuibbleLogo';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function RiderRegisterIntro() {
    const router = useRouter();
    const { theme: appTheme } = useTheme();
    const isDark = appTheme === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Hero Section with Gradient */}
            <LinearGradient
                colors={isDark ? ['#1F2050', '#0D0D1A'] : ['#1F2050', '#2A2A6A']}
                style={styles.heroSection}
            >
                {/* Decorative circles */}
                <View style={[styles.decorativeCircle, styles.circle1]} />
                <View style={[styles.decorativeCircle, styles.circle2]} />
                <View style={[styles.decorativeCircle, styles.circle3]} />

                <SafeAreaView style={styles.heroContent}>
                    {/* Logo and Badge */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoBg}>
                            <QuibbleLogo width={60} height={60} />
                        </View>
                        <View style={styles.riderBadge}>
                            <MaterialCommunityIcons name="motorbike" size={20} color="#fff" />
                        </View>
                    </View>

                    {/* Hero Icon */}
                    <View style={styles.heroIconContainer}>
                        <MaterialCommunityIcons name="bike-fast" size={100} color="rgba(255,255,255,0.9)" />
                    </View>

                    <Text style={styles.heroTitle}>Become a Quible Rider</Text>
                    <Text style={styles.heroSubtitle}>
                        Join our delivery network and earn on your own schedule
                    </Text>
                </SafeAreaView>
            </LinearGradient>

            {/* Content Section */}
            <View style={[styles.contentSection, { backgroundColor: theme.background }]}>
                {/* Benefits */}
                <View style={styles.benefitsContainer}>
                    <BenefitCard
                        icon="time-outline"
                        title="Flexible Hours"
                        description="Work when you want, as much as you want"
                        isDark={isDark}
                        theme={theme}
                    />
                    <BenefitCard
                        icon="wallet-outline"
                        title="Weekly Payouts"
                        description="Get paid directly to your wallet"
                        isDark={isDark}
                        theme={theme}
                    />
                    <BenefitCard
                        icon="location-outline"
                        title="Your Zone"
                        description="Choose areas you know best"
                        isDark={isDark}
                        theme={theme}
                    />
                </View>

                {/* CTA */}
                <View style={styles.ctaContainer}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.push('/rider/register/step1-personal')}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#1F2050', '#2A2A6A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.primaryButtonText}>Start Application</Text>
                            <Ionicons name="arrow-forward" size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={[styles.footerText, { color: theme.tabIconDefault }]}>
                        Already a rider? <Text style={styles.linkText}>Sign In</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}

function BenefitCard({
    icon,
    title,
    description,
    isDark,
    theme
}: {
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    description: string,
    isDark: boolean,
    theme: any
}) {
    return (
        <View style={[
            styles.benefitCard,
            {
                backgroundColor: isDark ? '#1A1A2E' : '#F8F9FF',
                borderColor: isDark ? '#2A2A4A' : '#E8E8FF'
            }
        ]}>
            <View style={[styles.benefitIconBox, { backgroundColor: isDark ? '#2A2A5A' : '#1F205015' }]}>
                <Ionicons name={icon} size={22} color={isDark ? '#F4821F' : '#1F2050'} />
            </View>
            <View style={styles.benefitTextContainer}>
                <Text style={[styles.benefitTitle, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.benefitDescription, { color: theme.tabIconDefault }]}>{description}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    heroSection: {
        height: height * 0.48,
        overflow: 'hidden',
    },
    decorativeCircle: {
        position: 'absolute',
        borderRadius: 500,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    circle1: {
        width: 300,
        height: 300,
        top: -100,
        right: -100,
    },
    circle2: {
        width: 200,
        height: 200,
        bottom: 50,
        left: -80,
    },
    circle3: {
        width: 150,
        height: 150,
        top: 100,
        left: width * 0.6,
    },
    heroContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    logoContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    logoBg: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    riderBadge: {
        position: 'absolute',
        bottom: -8,
        right: -8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F4821F',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#1F2050',
    },
    heroIconContainer: {
        marginBottom: 15,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 10,
    },
    heroSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 280,
    },
    contentSection: {
        flex: 1,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
        paddingTop: 25,
        paddingHorizontal: 20,
    },
    benefitsContainer: {
        gap: 12,
        marginBottom: 25,
    },
    benefitCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    benefitIconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    benefitTextContainer: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 3,
    },
    benefitDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    ctaContainer: {
        marginTop: 'auto',
        paddingBottom: 30,
    },
    primaryButton: {
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: "#1F2050",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    buttonGradient: {
        flexDirection: 'row',
        height: 58,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerText: {
        textAlign: 'center',
        marginTop: 18,
        fontSize: 14,
    },
    linkText: {
        color: '#F4821F',
        fontWeight: '600',
    },
});
