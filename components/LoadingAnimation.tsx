import React from 'react';
import { StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { ThemedView } from './themed-view';

const LoadingAnimation = () => {
  return (
    <ThemedView style={styles.container}>
      <LottieView
        source={{
          uri: 'https://lottie.host/a10a00ee-5584-4d09-9109-4b0c9c4248f6/LMNbfw22mU.lottie',
        }}
        autoPlay
        loop
        style={styles.lottie}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 300,
    height: 300,
  },
});

export default LoadingAnimation;
