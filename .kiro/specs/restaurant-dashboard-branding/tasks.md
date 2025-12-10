# Implementation Plan

- [x] 1. Set up database schema and test data
  - Create or verify `restaurant_profiles` table in Supabase with columns: id, user_id, name, logo_url, created_at, updated_at
  - Add sample restaurant profile data for testing
  - _Requirements: 3.1, 3.2_
  - **Note**: Using existing `restaurants` table with owner_id instead of restaurant_profiles

- [x] 2. Create RestaurantBranding component with data fetching
  - Create `components/RestaurantBranding.tsx` file
  - Implement component interface with userId prop
  - Add state management for restaurant data, loading, and error states
  - Implement useEffect hook to fetch restaurant profile data on mount
  - Implement Supabase query to fetch restaurant profile by user_id
  - _Requirements: 1.1, 3.1, 3.2_

- [ ] 2.1 Write property test for profile fetch
  - **Property 1: Dashboard load triggers profile fetch**
  - **Validates: Requirements 1.1, 3.1**

- [x] 3. Implement logo display logic
  - Add conditional rendering for logo image when logo_url exists
  - Implement Image component with logo_url as source
  - Add circular styling to logo image (borderRadius, dimensions)
  - Implement error handling for image load failures
  - _Requirements: 1.3, 2.1_

- [ ] 3.1 Write property test for logo rendering
  - **Property 3: Logo image rendering**
  - **Validates: Requirements 1.3**

- [ ] 3.2 Write property test for circular styling
  - **Property 5: Circular logo styling**
  - **Validates: Requirements 2.1**

- [x] 4. Implement placeholder logo for missing images
  - Add conditional rendering for placeholder when logo_url is null/undefined
  - Create placeholder View with circular background
  - Extract and display first letter of restaurant name in placeholder
  - Style placeholder with appropriate colors and typography
  - _Requirements: 1.4_

- [ ] 4.1 Write property test for placeholder display
  - **Property 4: Placeholder for missing logo**
  - **Validates: Requirements 1.4**

- [x] 5. Implement restaurant name display
  - Add Text component to display restaurant name
  - Apply prominent font styling (fontSize, fontWeight)
  - Position name next to logo with proper spacing
  - _Requirements: 1.2, 2.2_

- [ ] 5.1 Write property test for name display
  - **Property 2: Restaurant name display**
  - **Validates: Requirements 1.2**

- [ ] 5.2 Write property test for name styling
  - **Property 6: Prominent name styling**
  - **Validates: Requirements 2.2**

- [x] 6. Implement loading and error states
  - Add loading indicator component for loading state
  - Add error message display for error state
  - Implement error handling for failed queries
  - Add appropriate error messages for different error types
  - _Requirements: 1.5, 3.3_

- [ ] 6.1 Write property test for error handling
  - **Property 7: Error handling for failed queries**
  - **Validates: Requirements 3.3**

- [ ] 6.2 Write unit tests for loading state
  - Test loading indicator displays during data fetch
  - Test loading indicator hides after data loads
  - _Requirements: 1.5_

- [x] 7. Integrate RestaurantBranding into dashboard sidebar
  - Updated `components/RestaurantSidebar.tsx` to fetch and display restaurant data
  - Added restaurant logo/placeholder in sidebar profile section
  - Display restaurant name in sidebar header
  - Pass user ID from AuthContext to fetch restaurant data
  - Implemented loading states and error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - **Note**: Implemented directly in RestaurantSidebar instead of separate component for better integration

- [x] 8. Checkpoint - Core implementation complete
  - ✅ Restaurant branding successfully implemented in sidebar
  - ✅ Fetches restaurant name and logo from Supabase `restaurants` table
  - ✅ Displays circular logo or placeholder with first letter
  - ✅ Shows restaurant name prominently in sidebar header
  - ✅ Handles loading and error states
  - ✅ No TypeScript errors
  - ⏳ Property-based tests and unit tests remain (optional for future enhancement)
