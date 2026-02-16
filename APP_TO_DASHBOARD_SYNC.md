# Quible: App to Dashboard Sync Guide 🚀

This guide explains how the mobile app features interact with the backend and how the **Admin Dashboard** should manage them.

---

## 1. Support & FAQ System
**Mobile Component:** `app/(tabs)/Support.tsx`

### How it Works:
-   **Dynamic Config:** The app fetches contact details (WhatsApp, Email, Call Center) from the `support_config` table.
-   **FAQ Search:** Users can search for help topics locally.
-   **Triggers:** Clicking support buttons triggers external intents (WhatsApp API, Mailto, or Phone Dialer).

### Backend Details (`support_config` table):
-   **Columns:** `whatsapp_number`, `email_address`, `call_center_number`, `whatsapp_enabled`, `email_enabled`, etc.
-   **Permissions:** Read-only for users; Write for Admins.

### Admin Dashboard Action:
-   Build a **"Global Settings"** page to toggle these channels ON/OFF or update the contact numbers in real-time.

---

## 2. Help & Feedback System
**Mobile Component:** `app/profile/feedback.tsx`

### How it Works:
-   **Reporting:** Users submit a category (Bug, Suggestion, Other) and a text message.
-   **Storage:** Submissions are saved in the `feedback` table.

### Backend Details (`feedback` table):
-   **Columns:** `user_id`, `type`, `message`, `status` (default: 'open'), `created_at`.
-   **RLS:** Users can only `INSERT`. Only Admins can `SELECT` and `UPDATE`.

### Admin Dashboard Action:
-   Build a **"Feedback Inbox"**.
-   **Critical:** Must join with the `profiles` table to show the User's Name and Email next to each report.
-   **Workflow:** Admin reads the report and moves `status` from `open` to `closed` once addressed.

---

## 3. Store Registration (Upcoming)
**Mobile Component:** `app/store-registration/` (Planned)

### How it Works:
-   **Multi-Step Onboarding:** New vendors provide branding, location (GPS), business hours, and bank details.
-   **Submission:** Creates a record in the `restaurants` table with `status = 'pending'`.

### Backend Details (`restaurants` table):
-   **Columns:** `name`, `owner_id`, `address`, `latitude`, `longitude`, `status`, `business_license_url`.
-   **Permissions:** `INSERT` access for authenticated users.

### Admin Dashboard Action:
-   Build a **"Pending Approvals"** queue.
-   **Workflow:** Admin reviews the uploaded Business License and GPS location.
-   **Action:** Update `status` to `active` to make the restaurant visible on the platform, or `rejected` with a reason.

---

## 4. Summary Table for Dashboard AI

| Feature | Mobile Source | Supabase Table | Primary Admin Key |
| :--- | :--- | :--- | :--- |
| **Support Config** | `Support.tsx` | `support_config` | Update settings row |
| **User Feedback** | `feedback.tsx` | `feedback` | `status` (open -> closed) |
| **New Vendors** | Registration Form | `restaurants` | `status` (pending -> active) |
| **New Riders** | Waitlist Form | `riders` | `status` (pending -> active) |
