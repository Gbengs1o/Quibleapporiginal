
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mgaapnznifjeigxisjdw.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nYWFwbnpuaWZqZWlneGlzamR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODcyNjAsImV4cCI6MjA3ODk2MzI2MH0.rRnNyYtiJ1DPfWiN8lkrjCRUrucs5lIk6Fch5pKou8Q"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
