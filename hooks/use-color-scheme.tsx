import { useTheme } from './use-theme';

export const useColorScheme = () => {
  const { theme } = useTheme();
  return theme;
};
