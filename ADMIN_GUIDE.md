# Admin Approval System: Implementation Guide

This guide provides the necessary technical details for an AI agent to implement the registration approval workflow in the Quible Admin Dashboard.

## 1. Database Schema Overview

The approval system relies on three main tables. All tables use a `status` column to track the registration progress.

### Service Tables
- **`restaurants`**: Main table for restaurant registrations.
  - `status`: `pending`, `active`, `rejected`, `suspended`
  - `owner_id`: References the user (UUID)
  - Key fields to review: `business_license_url`, `owner_identification_url`
- **`stores`**: Main table for store registrations.
  - `status`: `pending`, `active`, `rejected`, `suspended`
  - `owner_id`: References the user (UUID)
  - Key fields to review: `business_license_url`, `owner_identification_url`
- **`riders`**: Main table for rider registrations.
  - `status`: `pending`, `active`, `rejected`, `suspended`
  - `user_id`: References the user (UUID)
  - Key fields to review: `documents` (JSONB) or specific document URLs.

### User Profiles
- **`profiles`**: Contains the primary user information.
  - `role`: `user`, `rider`, `restaurant`, `admin`
  - **Note**: While a user can have multiple service profiles, the `role` identifies their primary or current active role.

---

## 2. Implementation Logic

### A. Fetching Pending Registrations
The admin panel should query these tables for records where `status = 'pending'`.

```sql
-- Example: Fetching pending restaurants
SELECT * FROM restaurants WHERE status = 'pending' ORDER BY created_at DESC;

-- Example: Fetching pending stores
SELECT * FROM stores WHERE status = 'pending' ORDER BY created_at DESC;

-- Example: Fetching pending riders
SELECT * FROM riders WHERE status = 'pending' ORDER BY created_at DESC;
```

### B. Approving a Registration
To approve a service, update the `status` to `active`.

**Important**: You may also need to update the user's `role` in the `profiles` table to grant them proper permissions if they don't already have a business role.

```sql
-- Update Service Status
UPDATE restaurants SET status = 'active' WHERE id = 'SERVICE_ID';

-- Update User Role (Optional/Conditional)
UPDATE profiles SET role = 'restaurant' WHERE id = 'OWNER_ID';
```

### C. Rejecting a Registration
To reject a service, update the `status` to `rejected`. It is recommended to provide a reason for rejection (though you may need to add a `rejection_reason` column to the tables if it doesn't exist).

```sql
UPDATE restaurants SET status = 'rejected' WHERE id = 'SERVICE_ID';
```

---

## 3. Document Review (Storage)
Registration documents are stored in the Supabase Storage bucket: **`restaurant-documents`**.
The admin UI should display these images to allow the administrator to verify the business legitimacy.

---

## 4. Required Actions for the Admin Agent
1. **Build a List View**: Create a screen that lists all pending applications for Restaurants, Stores, and Riders.
2. **Build a Detail View**: Create a modal or page to view full details including uploaded documents (License, ID, etc.).
3. **Handle Approval/Rejection**: Implement buttons that trigger the `supabase.from('table').update({ status: 'active' })` calls.
4. **Notify User**: (Future) Integrate with the `notifications` table to alert the user when their application status changes.
