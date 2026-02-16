import { useTheme } from '@/hooks/use-theme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width - 32;

interface TabIconProps {
  name: string;
  isFocused: boolean;
  color: string;
  focusedColor: string;
  size: number;
}

const TabIcon = ({ name, isFocused, color, focusedColor, size }: TabIconProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.15 : 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const iconColor = isFocused ? focusedColor : color;

  const renderIcon = () => {
    switch (name) {
      case 'Home':
        return (
          <Ionicons
            name={isFocused ? 'home' : 'home-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'Profile':
        return (
          <Ionicons
            name={isFocused ? 'person' : 'person-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'Search':
        return (
          <Ionicons
            name={isFocused ? 'search' : 'search-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'Orders':
        return (
          <Ionicons
            name={isFocused ? 'cart' : 'cart-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'Support':
        return (
          <MaterialIcons
            name="support-agent"
            size={size}
            color={iconColor}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {renderIcon()}
    </Animated.View>
  );
};

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware colors
  const colors = {
    // Glass effect colors
    glassBackground: isDark
      ? 'rgba(30, 30, 40, 0.65)'
      : 'rgba(255, 255, 255, 0.75)',
    glassBorder: isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.08)',
    glassInnerBorder: isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.9)',

    // Tab colors
    inactiveTab: isDark ? 'rgba(180, 180, 190, 0.7)' : 'rgba(100, 110, 120, 0.8)',
    activeTab: '#f27c22', // App's primary orange
    activeBg: isDark
      ? 'rgba(242, 124, 34, 0.15)'
      : 'rgba(242, 124, 34, 0.12)',

    // Shadow
    shadowColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.15)',

    // Text
    inactiveText: isDark ? 'rgba(160, 160, 170, 0.9)' : 'rgba(80, 85, 90, 0.9)',
    activeText: '#f27c22',

    // Badge
    badge: '#ef4444',

    // Glow effect
    glowColor: isDark ? 'rgba(242, 124, 34, 0.35)' : 'rgba(242, 124, 34, 0.25)',
  };

  // Gradient colors for the liquid glass border effect
  const borderGradient = isDark
    ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.12)']
    : ['rgba(255,255,255,0.95)', 'rgba(200,200,200,0.3)', 'rgba(255,255,255,0.8)'];

  const filteredRoutes = state.routes.filter(
    (route) => route.name !== 'edit-profile'
  );

  // Adjust state.index for the filtered routes
  const getFilteredIndex = () => {
    const currentRoute = state.routes[state.index];
    return filteredRoutes.findIndex((r) => r.key === currentRoute.key);
  };

  return (
    <View style={[styles.outerContainer, { shadowColor: colors.shadowColor }]}>
      {/* Outer glow effect */}
      <View
        style={[
          styles.glowEffect,
          {
            backgroundColor: colors.glowColor,
            opacity: isDark ? 0.4 : 0.2,
          },
        ]}
      />

      {/* Main container with gradient border */}
      <View style={styles.gradientBorderContainer}>
        <LinearGradient
          colors={borderGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View
            style={[
              styles.innerContainer,
              { backgroundColor: colors.glassBackground },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.blurView}
            >
              {/* Inner highlight border for depth */}
              <View
                style={[
                  styles.innerBorder,
                  { borderColor: colors.glassInnerBorder },
                ]}
              />

              <View style={styles.tabBar}>
                {filteredRoutes.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const label =
                    options.tabBarLabel !== undefined
                      ? options.tabBarLabel
                      : options.title !== undefined
                        ? options.title
                        : route.name;

                  const filteredIndex = getFilteredIndex();
                  const isFocused = filteredIndex === index;

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

                  return (
                    <TouchableOpacity
                      key={route.key}
                      accessibilityRole="button"
                      accessibilityState={isFocused ? { selected: true } : {}}
                      accessibilityLabel={options.tabBarAccessibilityLabel}
                      onPress={onPress}
                      onLongPress={onLongPress}
                      style={styles.tabItem}
                      activeOpacity={0.7}
                    >
                      {/* Active indicator background */}
                      {isFocused && (
                        <View
                          style={[
                            styles.activeIndicator,
                            { backgroundColor: colors.activeBg },
                          ]}
                        />
                      )}

                      <View style={styles.tabContent}>
                        {/* Icon with optional badge */}
                        <View style={styles.iconContainer}>
                          <TabIcon
                            name={route.name}
                            isFocused={isFocused}
                            color={colors.inactiveTab}
                            focusedColor={colors.activeTab}
                            size={22}
                          />

                          {/* Badge for Orders removed as per request */}
                        </View>

                        {/* Label */}
                        <Text
                          style={[
                            styles.label,
                            {
                              color: isFocused
                                ? colors.activeText
                                : colors.inactiveText,
                              fontWeight: isFocused ? '600' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {typeof label === 'string' ? label : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </BlurView>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for depth
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  glowEffect: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 42,
    zIndex: -1,
  },
  gradientBorderContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 36,
    overflow: 'hidden',
  },
  gradientBorder: {
    flex: 1,
    padding: 1.5,
    borderRadius: 36,
  },
  innerContainer: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
  },
  blurView: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
  },
  innerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'transparent',
    zIndex: 1,
    pointerEvents: 'none',
  },
  tabBar: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 4,
    right: 4,
    borderRadius: 20,
    zIndex: 0,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 4,
  },
  iconContainer: {
    position: 'relative',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
});

export default TabBar;
