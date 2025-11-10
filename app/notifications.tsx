import React from 'react';
import { View, Text } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

const Notifications = () => {
  return (
    <ThemedView>
      <ThemedText type="title">Notifications</ThemedText>
    </ThemedView>
  );
};

export default Notifications;
