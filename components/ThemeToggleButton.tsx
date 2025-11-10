import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView } from 'expo-symbols';

const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <TouchableOpacity onPress={toggleTheme} style={{ marginRight: 15 }}>
      <SymbolView
        name={theme === 'dark' ? 'sun.max.fill' : 'moon.fill'}
        size={24}
        type="hierarchical"
        tintColor={theme === 'dark' ? 'white' : 'black'}
      />
    </TouchableOpacity>
  );
};

export default ThemeToggleButton;
