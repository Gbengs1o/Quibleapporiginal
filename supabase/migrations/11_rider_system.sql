-- Create riders table
CREATE TYPE rider_status AS ENUM ('pending', 'active', 'rejected', 'suspended');
CREATE TYPE vehicle_type AS ENUM ('bike', 'bicycle', 'tricycle', 'car', 'van', 'truck');

CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  status rider_status DEFAULT 'active', -- Instant access as requested
  
  -- Personal Details (specific to rider application)
  rider_photo TEXT, -- URL to real face photo
  home_address TEXT,
  
  -- Vehicle Details
  vehicle_type vehicle_type NOT NULL,
  vehicle_brand TEXT,
  vehicle_plate TEXT,
  
  -- License & ID Details
  license_number TEXT,
  license_expiry DATE,
  id_type TEXT, -- e.g., 'passport', 'national_id'
  id_number TEXT,
  
  -- Next of Kin
  next_of_kin_name TEXT,
  next_of_kin_phone TEXT,
  next_of_kin_relationship TEXT,
  
  -- Documents (JSONB to store URLs)
  documents JSONB DEFAULT '{}'::jsonb, 
  -- Structure: { "license_front": "url", "license_back": "url", "vehicle_photo": "url", "id_document": "url" }

  -- System fields
  is_online BOOLEAN DEFAULT false,
  current_latitude FLOAT,
  current_longitude FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for riders table
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Riders can view and update their own profile
CREATE POLICY "Riders can view own profile" 
ON riders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Riders can update own profile" 
ON riders FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Riders can insert own profile" 
ON riders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Storage for Rider Documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rider-documents', 'rider-documents', true) -- Made public for easier access for now, can be restricted later
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Riders can upload documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'rider-documents' AND auth.uid() = owner);

CREATE POLICY "Riders can view own documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'rider-documents' AND auth.uid() = owner);

CREATE POLICY "Public can view documents" -- For admin/display purposes if needed
ON storage.objects FOR SELECT
USING (bucket_id = 'rider-documents');
