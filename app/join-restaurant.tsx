
import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, View, Image } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/auth';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

const Page1 = ({ next, formData, setFormData }) => (
  <View>
    <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>
    <ThemedText style={styles.label}>Restaurant Name</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="Enter restaurant name"
      value={formData.restaurantName}
      onChangeText={(text) => setFormData({ ...formData, restaurantName: text })}
    />
    <ThemedText style={styles.label}>Owner/Manager Name</ThemedText>
    <TextInput
      style={styles.input}
      value={formData.ownerName}
      editable={false}
    />
    <ThemedText style={styles.label}>Address</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="Enter restaurant address"
      value={formData.address}
      onChangeText={(text) => setFormData({ ...formData, address: text })}
    />
    <ThemedText style={styles.label}>Phone Number</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="Enter phone number"
      value={formData.phoneNumber}
      onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
      keyboardType="phone-pad"
    />
    <TouchableOpacity style={styles.arrowButton} onPress={next}>
      <ThemedText style={styles.arrowButtonText}>→</ThemedText>
    </TouchableOpacity>
  </View>
);

const Page2 = ({ next, back, formData, setFormData }) => (
  <View>
    <ThemedText style={styles.sectionTitle}>Business Details</ThemedText>
    <ThemedText style={styles.label}>Short Description (max 50 chars)</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="A few words about your restaurant"
      value={formData.shortDescription}
      onChangeText={(text) => setFormData({ ...formData, shortDescription: text })}
      maxLength={50}
    />
    <ThemedText style={styles.label}>Detailed Description</ThemedText>
    <TextInput
      style={[styles.input, { height: 100 }]}
      placeholder="Describe what your restaurant serves. Note: Falsifying information may result in penalties."
      value={formData.detailedDescription}
      onChangeText={(text) => setFormData({ ...formData, detailedDescription: text })}
      multiline
    />
    <ThemedText style={styles.label}>Business Registration Number (optional)</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="Enter business registration number"
      value={formData.businessRegNumber}
      onChangeText={(text) => setFormData({ ...formData, businessRegNumber: text })}
    />
    <ThemedText style={styles.label}>Type of Cuisine</ThemedText>
    <TextInput
      style={styles.input}
      placeholder="e.g., Italian, Mexican, etc."
      value={formData.cuisineType}
      onChangeText={(text) => setFormData({ ...formData, cuisineType: text })}
    />
    <View style={styles.arrowContainer}>
      <TouchableOpacity style={styles.arrowButton} onPress={back}>
        <ThemedText style={styles.arrowButtonText}>←</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={styles.arrowButton} onPress={next}>
        <ThemedText style={styles.arrowButtonText}>→</ThemedText>
      </TouchableOpacity>
    </View>
  </View>
);

const Page3 = ({ next, back, formData, setFormData }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tries, setTries] = useState(3);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
    })();
  }, []);

  const getLocation = async () => {
    if (tries > 0) {
      let { coords } = await Location.getCurrentPositionAsync({});
      setLocation(coords);
      setFormData({ ...formData, latitude: coords.latitude, longitude: coords.longitude });
      setTries(tries - 1);
    } else {
      Alert.alert('Error', 'You have exceeded the maximum number of attempts.');
    }
  };

  const pickImage = async (field) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, [field]: result.assets[0].uri });
    }
  };

  return (
    <View>
      <ThemedText style={styles.sectionTitle}>Location and Images</ThemedText>
      <ThemedText style={{ color: 'red', marginBottom: 10 }}>
        You must be at the exact position of your restaurant to get the location. You have {tries} tries remaining.
      </ThemedText>
      <TouchableOpacity style={styles.button} onPress={getLocation}>
        <ThemedText style={styles.buttonText}>Get Position</ThemedText>
      </TouchableOpacity>
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={location} />
        </MapView>
      )}
      <ThemedText style={styles.label}>Restaurant Logo (optional)</ThemedText>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('logo')}>
        <ThemedText>Upload Logo</ThemedText>
      </TouchableOpacity>
      {formData.logo && <Image source={{ uri: formData.logo }} style={styles.previewImage} />}

      <ThemedText style={styles.label}>Restaurant Picture</ThemedText>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('restaurantPicture')}>
        <ThemedText>Upload Picture</ThemedText>
      </TouchableOpacity>
      {formData.restaurantPicture && <Image source={{ uri: formData.restaurantPicture }} style={styles.previewImage} />}
      <View style={styles.arrowContainer}>
        <TouchableOpacity style={styles.arrowButton} onPress={back}>
          <ThemedText style={styles.arrowButtonText}>←</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrowButton} onPress={next}>
          <ThemedText style={styles.arrowButtonText}>→</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const Page4 = ({ back, submit, formData, setFormData }) => {
  const pickImage = async (field) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, [field]: result.assets[0].uri });
    }
  };

  return (
    <View>
      <ThemedText style={styles.sectionTitle}>Document Verification</ThemedText>
      <ThemedText style={styles.label}>Business license/food permit</ThemedText>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('businessLicense')}>
        <ThemedText>Upload Document</ThemedText>
      </TouchableOpacity>
      {formData.businessLicense && <Image source={{ uri: formData.businessLicense }} style={styles.previewImage} />}

      <ThemedText style={styles.label}>Identification of owner/manager</ThemedText>
      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('ownerId')}>
        <ThemedText>Upload Document</ThemedText>
      </TouchableOpacity>
      {formData.ownerId && <Image source={{ uri: formData.ownerId }} style={styles.previewImage} />}
      
      <View style={styles.arrowContainer}>
        <TouchableOpacity style={styles.arrowButton} onPress={back}>
          <ThemedText style={styles.arrowButtonText}>←</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={submit}>
          <ThemedText style={styles.buttonText}>I've completed my registration</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const JoinRestaurantScreen = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: user ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : '',
    address: '',
    phoneNumber: '',
    shortDescription: '',
    detailedDescription: '',
    businessRegNumber: '',
    cuisineType: '',
    latitude: null,
    longitude: null,
    logo: null,
    restaurantPicture: null,
    businessLicense: null,
    ownerId: null,
  });

  const uploadFile = async (uri, fileName) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage
      .from('restaurant-documents')
      .upload(fileName, blob);
    if (error) {
      throw error;
    }
    return data.path;
  };
  
  const handleRegister = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to register a restaurant.');
      return;
    }

    try {
      let logoUrl = null;
      if (formData.logo) {
        logoUrl = await uploadFile(formData.logo, `logo-${user.id}-${Date.now()}`);
      }

      let restaurantPictureUrl = null;
      if (formData.restaurantPicture) {
        restaurantPictureUrl = await uploadFile(formData.restaurantPicture, `restaurant-picture-${user.id}-${Date.now()}`);
      }

      let businessLicenseUrl = null;
      if (formData.businessLicense) {
        businessLicenseUrl = await uploadFile(formData.businessLicense, `business-license-${user.id}-${Date.now()}`);
      }
      
      let ownerIdUrl = null;
      if (formData.ownerId) {
        ownerIdUrl = await uploadFile(formData.ownerId, `owner-id-${user.id}-${Date.now()}`);
      }

      const { data, error } = await supabase
        .from('restaurants')
        .insert([
          {
            owner_id: user.id,
            name: formData.restaurantName,
            address: formData.address,
            phone_number: formData.phoneNumber,
            short_description: formData.shortDescription,
            detailed_description: formData.detailedDescription,
            cuisine_type: formData.cuisineType,
            business_registration_number: formData.businessRegNumber,
            latitude: formData.latitude,
            longitude: formData.longitude,
            location: `POINT(${formData.longitude} ${formData.latitude})`,
            logo_url: logoUrl,
            restaurant_picture_url: restaurantPictureUrl,
            business_license_url: businessLicenseUrl,
            owner_identification_url: ownerIdUrl,
          },
        ]);

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Restaurant registered successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedText type="title" style={styles.title}>Restaurant Registration</ThemedText>
        {page === 1 && <Page1 next={() => setPage(2)} formData={formData} setFormData={setFormData} />}
        {page === 2 && <Page2 next={() => setPage(3)} back={() => setPage(1)} formData={formData} setFormData={setFormData} />}
        {page === 3 && <Page3 next={() => setPage(4)} back={() => setPage(2)} formData={formData} setFormData={setFormData} />}
        {page === 4 && <Page4 back={() => setPage(3)} submit={handleRegister} formData={formData} setFormData={setFormData} />}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  label: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f3f3f3',
    padding: 15,
    borderRadius: 6,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1f2050',
    padding: 20,
    borderRadius: 7,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  arrowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  arrowButton: {
    padding: 10,
  },
  arrowButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#e0e0e0',
    padding: 15,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 6,
    marginBottom: 20,
  },
  map: {
    height: 200,
    marginBottom: 20,
  },
});

export default JoinRestaurantScreen;
