-- Menu Items Database Migration
-- Run this in your Supabase SQL Editor

-- Create category enum
CREATE TYPE dish_category AS ENUM ('African dishes', 'Special dishes', 'Others');

-- Create menu_items table
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category dish_category NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  sides TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_active ON menu_items(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Restaurant owners can manage their menu items
CREATE POLICY "Owners can manage menu items" ON menu_items
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

-- Anyone can view active menu items
CREATE POLICY "Anyone can view active items" ON menu_items
  FOR SELECT USING (is_active = true);
