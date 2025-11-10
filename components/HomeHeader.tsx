import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  Platform,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface HomeHeaderProps {
  onMenuPress: () => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ onMenuPress }) => {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      {/* SVG Curved Background - More pronounced wave */}
      <Svg 
        height="200" 
        width={width} 
        style={styles.svgCurve}
        viewBox={`0 0 ${width} 200`}
      >
        <Path
          d={`M 0 0 L 0 120 Q ${width / 2} 180 ${width} 120 L ${width} 0 Z`}
          fill="#1F2051"
        />
      </Svg>
      
      {/* Content Layer */}
      <View style={styles.contentRow}>
        {/* Left: Menu Button */}
        <TouchableOpacity 
          style={styles.buttonContainer}
          onPress={onMenuPress}
        >
          <Ionicons name="menu" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Center: Location */}
        <View style={styles.centerSection}>
          <Text style={styles.deliveryLabel}>Delivery to:</Text>
          <TouchableOpacity style={styles.locationButton}>
            <Text style={styles.locationName}>Lagos, Nigeria</Text>
            <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        {/* Right: Bell & Avatar */}
        <View style={styles.rightSection}>
          <TouchableOpacity 
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications" size={24} color="#FFFFFF" />
            {/* Red notification dot */}
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/Profile')}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }} 
              style={styles.profileImage} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 200,
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  svgCurve: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    zIndex: 10,
  },
  buttonContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  centerSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  deliveryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
    opacity: 0.9,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  chevron: {
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  bellButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default HomeHeader;
