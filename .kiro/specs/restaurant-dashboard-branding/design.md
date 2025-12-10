# Design Document: Restaurant Dashboard Branding

## Overview

This feature enhances the restaurant dashboard by adding visual branding elements (restaurant name and logo) to the header. The implementation will fetch restaurant profile data from Supabase and display it prominently in the dashboard header, providing clear visual identity for restaurant owners.

## Architecture

The feature follows a component-based architecture with clear separation of concerns:

1. **Data Layer**: Supabase client for fetching restaurant profile data
2. **State Management**: React hooks (useState, useEffect) for managing restaurant data and loading states
3. **UI Layer**: React Native components for rendering the branding elements
4. **Context Integration**: Uses existing AuthContext to get authenticated user information

## Components and Interfaces

### RestaurantBranding Component

A new reusable component that encapsulates the restaurant branding display logic.

**Props Interface:**
```typescript
interface RestaurantBrandingProps {
  userId: string;
  style?: ViewStyle;
}
```

**Responsibilities:**
- Fetch restaurant profile data based on user ID
- Handle loading and error states
- Render restaurant logo (or placeholder)
- Render restaurant name

### Restaurant Profile Data Model

```typescript
interface RestaurantProfile {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}
```

### Database Schema

**Table: `restaurant_profiles`**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `name` (text, not null)
- `logo_url` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Data Models

### Restaurant Profile Query

The system will query the `restaurant_profiles` table using the authenticated user's ID:

```typescript
const { data, error } = await supabase
  .from('restaurant_profiles')
  .select('id, name, logo_url')
  .eq('user_id', userId)
  .single();
```

### Logo Display Logic

- If `logo_url` exists and is valid: Display the image from the URL
- If `logo_url` is null or invalid: Display a placeholder with the first letter of the restaurant name
- Placeholder styling: Circular background with centered text

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Dashboard load triggers profile fetch
*For any* authenticated user ID, when the Restaurant Dashboard component mounts, the system should initiate a query to fetch restaurant profile data using that user ID.
**Validates: Requirements 1.1, 3.1**

### Property 2: Restaurant name display
*For any* restaurant profile with a name, when the profile data is loaded, the rendered output should contain the restaurant name text.
**Validates: Requirements 1.2**

### Property 3: Logo image rendering
*For any* restaurant profile with a valid logo URL, when the profile data is loaded, the system should render an Image component with that logo URL as the source.
**Validates: Requirements 1.3**

### Property 4: Placeholder for missing logo
*For any* restaurant profile without a logo URL (null or undefined), when the profile data is loaded, the system should display a placeholder containing the first letter of the restaurant name.
**Validates: Requirements 1.4**

### Property 5: Circular logo styling
*For any* rendered restaurant logo image, the image component should have circular styling applied (borderRadius equal to half the width/height).
**Validates: Requirements 2.1**

### Property 6: Prominent name styling
*For any* rendered restaurant name text, the text component should have prominent font styling (fontSize >= 16 and fontWeight bold or numeric >= 600).
**Validates: Requirements 2.2**

### Property 7: Error handling for failed queries
*For any* restaurant profile query that fails, the system should set an error state and display an error message to the user.
**Validates: Requirements 3.3**

## Error Handling

### Query Errors
- Network failures: Display "Unable to load restaurant information. Please check your connection."
- No restaurant profile found: Display "Restaurant profile not found. Please contact support."
- Invalid data format: Log error and display generic error message

### Image Loading Errors
- Invalid logo URL: Fall back to placeholder logo
- Image load failure: Fall back to placeholder logo
- Network timeout: Show placeholder after 5 seconds

### State Management
- Use error state to track and display errors
- Use loading state to show loading indicators
- Clear errors on successful data fetch

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

1. **Component Rendering Tests**
   - Test that component renders without crashing
   - Test loading state display
   - Test error state display

2. **Data Fetching Tests**
   - Test successful data fetch
   - Test error handling for failed queries
   - Test handling of missing user ID

3. **Logo Display Tests**
   - Test logo image rendering with valid URL
   - Test placeholder rendering when logo is null
   - Test placeholder shows correct first letter

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (JavaScript/TypeScript property-based testing library).

**Configuration**: Each property test will run a minimum of 100 iterations.

**Test Tagging**: Each property-based test will include a comment with the format:
`// Feature: restaurant-dashboard-branding, Property {number}: {property_text}`

**Properties to Test**:

1. **Profile Fetch Property**: For any user ID, mounting the component should trigger a database query
2. **Name Display Property**: For any restaurant name, the rendered output should contain that name
3. **Logo Rendering Property**: For any valid logo URL, an Image component should be rendered with that URL
4. **Placeholder Property**: For any restaurant name without a logo, a placeholder with the first letter should be displayed
5. **Circular Styling Property**: For any logo image, circular styling should be applied
6. **Name Styling Property**: For any restaurant name, prominent font styling should be applied
7. **Error Handling Property**: For any query error, an error message should be displayed

**Generators**:
- User ID generator: Random UUIDs
- Restaurant name generator: Random strings (1-100 characters, various languages)
- Logo URL generator: Valid and invalid URLs, null values
- Query response generator: Success and error responses

## Implementation Details

### File Structure
```
components/
  RestaurantBranding.tsx       # New component
  RestaurantBranding.test.tsx  # Unit tests
  RestaurantBranding.property.test.tsx  # Property-based tests
app/restaurant/
  dashboard.tsx                # Updated to use RestaurantBranding
```

### Component Integration

The RestaurantBranding component will be integrated into the existing dashboard header:

```typescript
<View style={styles.header}>
  <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
    <Ionicons name="menu" size={30} color="#1f2050" />
  </TouchableOpacity>
  <RestaurantBranding userId={user?.id} />
  <View style={{ width: 30 }} />
</View>
```

### Styling Approach

- Use React Native StyleSheet for consistent styling
- Implement responsive sizing using percentage-based dimensions where appropriate
- Use theme colors from existing theme system
- Maintain visual hierarchy with proper spacing

### Performance Considerations

- Cache restaurant profile data to avoid unnecessary refetches
- Use React.memo for RestaurantBranding component to prevent unnecessary re-renders
- Implement image caching for logo URLs
- Debounce any potential rapid re-fetches

### Accessibility

- Provide accessible labels for logo images
- Ensure text has sufficient contrast
- Support screen readers with proper semantic markup
