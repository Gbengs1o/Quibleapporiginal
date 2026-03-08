# Support & FAQs Control System: Admin Implementation Guide

This guide provides the technical details for an AI agent to build a management dashboard for the Quible Support and FAQ systems.

## 1. Database Schema Overview

### A. FAQs Table (`faqs`)
This table stores the questions and answers displayed in the mobile app.

- **`id`**: `UUID` (Primary Key)
- **`question`**: `TEXT` - The FAQ question.
- **`answer`**: `TEXT` - The detailed response.
- **`category`**: `TEXT` - Groups the FAQs (e.g., 'Payments', 'Riders', 'Account').
- **`is_active`**: `BOOLEAN` - Controls whether the FAQ is visible in the app.
- **`sort_order`**: `INTEGER` - Determines the display sequence.

### B. Support Config Table (`support_config`)
A singleton table that stores the global contact settings.

- **`id`**: `UUID` (Fixed value: `00000000-0000-0000-0000-000000000000`)
- **`whatsapp_enabled`**: `BOOLEAN`
- **`whatsapp_number`**: `TEXT`
- **`email_enabled`**: `BOOLEAN`
- **`email_address`**: `TEXT`
- **`call_center_enabled`**: `BOOLEAN`
- **`call_center_number`**: `TEXT`
- **`live_chat_enabled`**: `BOOLEAN`

---

## 2. Required Administrative Features

### Phase 1: Support Settings Control
The Admin AI should build a single-page form to update the `support_config` record.

- **Fetch Data**: `SELECT * FROM support_config LIMIT 1;`
- **Update Data**: `UPDATE support_config SET ... WHERE id = '00000000-0000-0000-0000-000000000000';`
- **UI Element**: Toggles for enabled/disabled states and text inputs for contact details.

### Phase 2: FAQ Management
A CRUD interface for the `faqs` table.

- **List View**: Display all FAQs grouped by category.
- **Create New**: A form to add a new question/answer.
- **Edit/Delete**: Ability to modify content or deactivate (`is_active = false`) old entries.
- **Reordering**: (Optional/Bonus) Ability to change `sort_order`.

---

## 3. Implementation Instructions for Admin AI

1. **Investigate the Backend**: Before building, verify the table names and types by running a `DESCRIBE` or checking the `supabase/migrations` folder (specifically `49_support_config.sql`).
2. **Handle Row Level Security (RLS)**: Ensure your updates use the appropriate role. Only users with `role = 'admin'` in the `profiles` table are permitted to perform UPDATE or INSERT operations on these tables.
3. **Optimistic Updates**: The mobile app fetches this data once on load. Ensure the admin dashboard provides clear feedback when a change is successfully saved to Supabase.
4. **Validation**: Ensure phone numbers are stored in international format (e.g., `+234...`) and email addresses are valid.
