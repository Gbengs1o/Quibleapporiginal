import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  Dimensions,
  Switch,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import QuibbleLogo from './QuibbleLogo';
import * as Location from 'expo-location';
import LocationPermissionRequest from './LocationPermissionRequest';

const { width } = Dimensions.get('window');

interface HomeHeaderProps {
  onMenuPress: () => void;
  profile: any;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ onMenuPress, profile }) => {
  const router = useRouter();
  const [location, setLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

  const fetchLocation = async () => {
    setLoading(true);
    let location = await Location.getCurrentPositionAsync({});
    const address = await Location.reverseGeocodeAsync(location.coords);
    if (address.length > 0) {
      setLocation(`${address[0].city}, ${address[0].country}`);
    } else {
      setLocation('Location not found');
    }
    setLoading(false);
  };

  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStatus('granted');
      fetchLocation();
    } else if (status === 'denied') {
      setPermissionStatus('denied');
      setLocation('Location permission denied');
      setLoading(false);
    } else {
      setPermissionStatus('undetermined');
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  const handleGrantPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStatus('granted');
      fetchLocation();
    } else {
      setPermissionStatus('denied');
      setLocation('Location permission denied');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Location is Important",
      "Quible uses your location to provide you with the best experience, including finding nearby services and accurate delivery estimates.",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Continue Anyway",
          onPress: () => {
            setPermissionStatus('denied');
            setLocation('Lagos, Nigeria'); // Default location
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrapper}>
      <Modal
        visible={permissionStatus === 'undetermined'}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <LocationPermissionRequest onGrantPermission={handleGrantPermission} onSkip={handleSkip} />
      </Modal>
      {/* SVG Curved Background */}
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
          {permissionStatus === 'granted' ? (
            <>
              <Text style={styles.deliveryLabel}>Delivery to:</Text>
              <TouchableOpacity style={styles.locationButton}>
                <Text style={styles.locationName}>{loading ? 'Loading...' : location}</Text>
                <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={styles.chevron} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.locationToggleContainer}>
              <Text style={styles.locationToggleText}>Turn on location for a proper experience</Text>
              <Switch
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={permissionStatus === 'granted' ? '#f5dd4b' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={handleGrantPermission}
                value={permissionStatus === 'granted'}
              />
            </View>
          )}
        </View>

        {/* Right: Bell & Avatar */}
        <View style={styles.rightSection}>
          <TouchableOpacity 
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications" size={24} color="#FFFFFF" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/(tabs)/Profile')}>
            {profile?.profile_picture_url ? (
              <Image 
                source={{ uri: profile.profile_picture_url }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={styles.logoWrapper}>
                <QuibbleLogo width={30} height={30} />
              </View>
            )}
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
    alignItems: 'center',
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
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDBF50' // A background color for the logo
  },
  locationToggleContainer: {
    alignItems: 'center',
  },
  locationToggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
});

export default HomeHeader;
