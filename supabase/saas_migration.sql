-- =================================================================
-- Multi-Tenant SaaS Database Migration
-- Completely non-destructive: Pre-seeds The Target Library as Tenant #1
-- Guarantees 100% backward compatibility with zero data loss.
-- =================================================================

-- 1. Create Libraries Table
CREATE TABLE IF NOT EXISTS libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    logo_url TEXT,
    
    -- Payment / UPI Configuration
    upi_id VARCHAR(100),
    upi_name VARCHAR(255),
    
    -- SaaS Billing Configuration
    monthly_fee INT NOT NULL DEFAULT 600,
    discount_code VARCHAR(50),
    is_lifetime_fixed BOOLEAN DEFAULT FALSE,
    subscription_status VARCHAR(50) DEFAULT 'active', -- 'trial', 'active', 'past_due', 'suspended'
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '365 days'),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed The Target Library as Tenant #1 with deterministic UUID
-- Locks rate permanently at ₹400/month with lifetime guarantee
INSERT INTO libraries (
    id,
    slug,
    name,
    city,
    phone,
    address,
    upi_id,
    upi_name,
    monthly_fee,
    is_lifetime_fixed,
    subscription_status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'target-library',
    'The Target Library',
    'Dehradun',
    '9876543210',
    'Dehradun, Uttarakhand',
    'targetlibrary@upi',
    'The Target Library',
    400,
    TRUE,
    'active'
) ON CONFLICT (slug) DO UPDATE SET
    monthly_fee = 400,
    is_lifetime_fixed = TRUE;

-- 3. Library Dynamic Settings (Owner Configurable)
CREATE TABLE IF NOT EXISTS library_settings (
    library_id UUID PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    total_seats INT NOT NULL DEFAULT 50,
    shifts_config JSONB NOT NULL DEFAULT '[
        {"id": "full_day", "name": "Full Day (6 AM - 12 AM)", "start_time": "06:00", "end_time": "00:00", "base_price": 900, "sheet_price": 1200},
        {"id": "shift_1", "name": "Shift 1 (6 AM - 2 PM)", "start_time": "06:00", "end_time": "14:00", "base_price": 600, "sheet_price": 900},
        {"id": "shift_2", "name": "Shift 2 (2 PM - 12 AM)", "start_time": "14:00", "end_time": "00:00", "base_price": 600, "sheet_price": 900},
        {"id": "shift_3", "name": "Shift 3 (4 PM - 12 AM)", "start_time": "16:00", "end_time": "00:00", "base_price": 500, "sheet_price": 800}
    ]',
    has_sheet_enabled BOOLEAN DEFAULT TRUE,
    sheet_price_monthly INT DEFAULT 300,
    require_aadhar BOOLEAN DEFAULT TRUE,
    allow_student_self_registration BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Target Library Settings (297 seats)
INSERT INTO library_settings (
    library_id,
    total_seats,
    has_sheet_enabled,
    sheet_price_monthly,
    require_aadhar,
    allow_student_self_registration
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    297,
    TRUE,
    300,
    TRUE,
    TRUE
) ON CONFLICT (library_id) DO NOTHING;

-- 4. Library Staff & Owner Accounts
CREATE TABLE IF NOT EXISTS library_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff')),
    full_name VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (library_id, username)
);

-- Seed Target Library Owner & Staff accounts
INSERT INTO library_users (
    library_id,
    username,
    password_hash,
    role,
    full_name
) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'owner',
    'TargetOwner2026',
    'owner',
    'Target Library Owner'
),
(
    '00000000-0000-0000-0000-000000000001',
    'staff',
    'target2026',
    'staff',
    'Front Desk Staff'
) ON CONFLICT (library_id, username) DO NOTHING;

-- 5. Student Admission Requests Queue (Method B Entrance QR)
CREATE TABLE IF NOT EXISTS admission_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    student_phone VARCHAR(20) NOT NULL,
    aadhar_no VARCHAR(20),
    
    subscription_type VARCHAR(50) NOT NULL,
    shift_type VARCHAR(50),
    has_sheet BOOLEAN DEFAULT FALSE,
    amount_paid NUMERIC(10, 2) NOT NULL,
    
    payment_mode VARCHAR(20) DEFAULT 'online',
    utr_number VARCHAR(50),
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    assigned_seat_id INT,
    assigned_receipt_no BIGINT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES library_users(id)
);

-- 6. Safely Associate Existing Tables with Target Library
ALTER TABLE members ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES libraries(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE seats ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES libraries(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES libraries(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS utr_number VARCHAR(50);

-- Backfill any existing rows
UPDATE members SET library_id = '00000000-0000-0000-0000-000000000001' WHERE library_id IS NULL;
UPDATE seats SET library_id = '00000000-0000-0000-0000-000000000001' WHERE library_id IS NULL;
UPDATE receipts SET library_id = '00000000-0000-0000-0000-000000000001' WHERE library_id IS NULL;

-- 7. Enable RLS and Open Development Access
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all libraries" ON libraries;
CREATE POLICY "allow all libraries" ON libraries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all library_settings" ON library_settings;
CREATE POLICY "allow all library_settings" ON library_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all library_users" ON library_users;
CREATE POLICY "allow all library_users" ON library_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all admission_requests" ON admission_requests;
CREATE POLICY "allow all admission_requests" ON admission_requests FOR ALL USING (true) WITH CHECK (true);
