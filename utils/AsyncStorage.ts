
import { Platform } from 'react-native';

let AsyncStorage: any;

if (Platform.OS !== 'web') {
  // Use the real AsyncStorage on non-web platforms
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} else {
  // Use a mock AsyncStorage on the web (server-side)
  AsyncStorage = {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  };
}

export default AsyncStorage;
