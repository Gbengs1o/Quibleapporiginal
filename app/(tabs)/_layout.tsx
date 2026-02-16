
import TabBar from '@/components/TabBar';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="Home" />
      <Tabs.Screen name="Profile" />
      <Tabs.Screen name="Search" />
      <Tabs.Screen name="Orders" />
      <Tabs.Screen name="Support" />
    </Tabs>
  );
}
