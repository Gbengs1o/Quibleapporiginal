import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

export const getHeaderTitle = (route: any) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';

  switch (routeName) {
    case 'Home':
      return 'Home';
    case 'Profile':
      return 'Profile';
    case 'Search':
      return 'Search';
    case 'Orders':
      return 'Orders';
    case 'Support':
      return 'Support';
    default:
      return 'Home';
  }
};
