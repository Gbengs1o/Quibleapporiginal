-- ============================================================
-- Categories table: admin-editable categories for restaurants & stores
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('restaurant', 'store')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: no duplicate names within the same type
CREATE UNIQUE INDEX idx_categories_name_type ON categories (name, type);

-- Index for fast lookups by type + active
CREATE INDEX idx_categories_type_active ON categories (type, is_active, sort_order);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read active categories
CREATE POLICY "Public can read active categories"
    ON categories FOR SELECT
    USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins full access to categories"
    ON categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================================
-- Seed with current hardcoded values
-- ============================================================

-- Restaurant categories
INSERT INTO categories (name, type, sort_order) VALUES
    ('African dishes', 'restaurant', 1),
    ('Special dishes', 'restaurant', 2),
    ('Others',         'restaurant', 3);

-- Store categories
INSERT INTO categories (name, type, sort_order) VALUES
    ('Grocery',          'store', 1),
    ('Electronics',      'store', 2),
    ('Fashion',          'store', 3),
    ('Health & Beauty',  'store', 4),
    ('Home & Office',    'store', 5),
    ('Pharmacy',         'store', 6),
    ('Supermarket',      'store', 7),
    ('Beauty',           'store', 8),
    ('Home',             'store', 9),
    ('Others',           'store', 10);
