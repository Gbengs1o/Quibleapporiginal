import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';

interface LocationPermissionRequestProps {
  onGrantPermission: () => void;
  onSkip: () => void;
}

const LocationPermissionRequest: React.FC<LocationPermissionRequestProps> = ({ onGrantPermission, onSkip }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turn on Location services to continue with Quible</Text>
      <LottieView
        source={{ uri: 'https://lottie.host/e18a5a6c-c4d1-4307-ac0a-692f9d3c8345/KZkyDLu0Fd.lottie' }}
        autoPlay
        loop
        style={styles.lottie}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.turnOnButton} onPress={onGrantPermission}>
          <Text style={styles.turnOnButtonText}>Turn On</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={onSkip}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  lottie: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  turnOnButton: {
    backgroundColor: '#1F2051',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  turnOnButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2051',
  },
  continueButtonText: {
    color: '#1F2051',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default LocationPermissionRequest;
