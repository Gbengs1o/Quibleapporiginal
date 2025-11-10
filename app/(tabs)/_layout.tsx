
import { Tabs } from 'expo-router';
import React from 'react';
import TabBar from '@/components/TabBar';

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
