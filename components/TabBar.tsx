import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SymbolView } from 'expo-symbols';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTheme } from '@/hooks/use-theme';

const { width } = Dimensions.get('window');

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { theme } = useTheme();
  const themedStyles = {
    tabBarContainer: {
      ...styles.tabBarContainer,
      shadowColor: useThemeColor({ light: '#000', dark: '#fff' }, 'text'),
    },
    tabItemColor: useThemeColor({ light: '#687076', dark: '#a0a0a0' }, 'text'),
    tabItemFocusedColor: useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint'),
    badgeBackgroundColor: useThemeColor({ light: '#0A84FF', dark: '#0A84FF' }, 'tint'),
  };

  return (
    <View style={themedStyles.tabBarContainer}>
      <BlurView intensity={20} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.blurView}>
        <View style={styles.tabBar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, { merge: true });
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const renderIcon = (routeName: string, isFocused: boolean) => {
              const color = isFocused ? themedStyles.tabItemFocusedColor : themedStyles.tabItemColor;
              const size = 24;

              switch (routeName) {
                case 'Home':
                  return <Ionicons name={isFocused ? "home" : "home-outline"} size={size} color={color} />;
                case 'Profile':
                  return <Ionicons name="person-circle-outline" size={size} color={color} />;
                case 'Search':
                  return <Ionicons name="search" size={size} color={color} />;
                case 'Orders':
                  return (
                    <View>
                      <Ionicons name="cube-outline" size={size} color={color} />
                      <View style={[styles.badge, { backgroundColor: themedStyles.badgeBackgroundColor }]}>
                        <Text style={styles.badgeText}>1</Text>
                      </View>
                    </View>
                  );
                case 'Support':
                  return <MaterialIcons name="support-agent" size={size} color={color} />;
                default:
                  return null;
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItem}
              >
                {renderIcon(route.name, isFocused)}
                <Text style={{ color: isFocused ? themedStyles.tabItemFocusedColor : themedStyles.tabItemColor, fontSize: 10 }}>
                  {typeof label === 'string' ? label : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 21,
    elevation: 5,
  },
  blurView: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -10,
    top: -5,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default TabBar;
