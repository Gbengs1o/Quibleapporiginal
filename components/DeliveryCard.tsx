import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DeliveryCard = () => {
  const { theme } = useTheme();
  const router = useRouter(); // Hook
  const cardBackgroundColor = theme === 'dark' ? '#1c1c1e' : '#ffffff';
  const textColor = theme === 'dark' ? '#ffffff' : '#1F2051';
  const shadowColor = theme === 'dark' ? '#000' : '#1F2051';
  const buttonBackgroundColor = theme === 'dark' ? '#1F2051' : '#1F2051';
  const buttonTextColor = theme === 'dark' ? '#ffffff' : '#ffffff';

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: cardBackgroundColor,
        shadowColor: shadowColor,
      }
    ]}>
      <View style={styles.imageContainer}>
        <View style={styles.imageBackgroundOuter}>
          <View style={styles.imageBackgroundInner} />
        </View>
        <Image source={require('@/assets/images/bike.png')} style={styles.image} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.lightText, { color: textColor }]}>
          Need to send or{'\n'}deliver something?
        </Text>
        <Text style={[styles.boldText, { color: textColor }]}>
          Quible Delivery got{'\n'}you covered
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: buttonBackgroundColor }]}
          activeOpacity={0.8}
          onPress={() => router.push('/send-package')}
        >
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>Try now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1F2051',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  imageBackgroundOuter: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2a2d54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBackgroundInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3b3e6e',
  },
  image: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    zIndex: 1,
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  lightText: {
    fontSize: 16,
    fontFamily: 'OpenSans-Light',
    lineHeight: 22,
    marginBottom: 4,
  },
  boldText: {
    fontSize: 17,
    fontFamily: 'Montserrat-SemiBold',
    lineHeight: 24,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#1F2051',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'OpenSans-SemiBold',
    letterSpacing: 0.3,
  },
});

export default DeliveryCard;