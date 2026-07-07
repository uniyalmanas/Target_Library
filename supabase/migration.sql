-- ============================================
-- The Target Library — Management System Schema
-- Run this entire file in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → paste → Run
-- ============================================

-- Members: permanent identity, survives across renewals
CREATE TABLE IF NOT EXISTS members (
    student_id      BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(15),
    date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seats: static seats 1-1000
CREATE TABLE IF NOT EXISTS seats (
    seat_id     SERIAL PRIMARY KEY,
    seat_number INT UNIQUE NOT NULL CHECK (seat_number BETWEEN 1 AND 1000)
);

-- Receipts: one row per transaction (signup or renewal).
-- This IS the subscription record — start/end date live here.
CREATE TABLE IF NOT EXISTS receipts (
    receipt_no        BIGSERIAL PRIMARY KEY,
    student_id        BIGINT NOT NULL REFERENCES members(student_id) ON DELETE CASCADE,
    seat_id           INT NOT NULL REFERENCES seats(seat_id),
    subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('full_day','half_day')),
    shift_type        VARCHAR(20) CHECK (shift_type IN ('morning','evening')),
    has_sheet         BOOLEAN NOT NULL DEFAULT FALSE,
    amount_paid       NUMERIC(10,2) NOT NULL,
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),

    -- half_day must have a shift, full_day must not
    CONSTRAINT shift_matches_type CHECK (
        (subscription_type = 'half_day' AND shift_type IS NOT NULL) OR
        (subscription_type = 'full_day' AND shift_type IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_receipts_enddate ON receipts(end_date);
CREATE INDEX IF NOT EXISTS idx_receipts_seat ON receipts(seat_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);

-- Seed 1000 seats (safe to re-run, does nothing if already seeded)
INSERT INTO seats (seat_number)
SELECT generate_series(1, 1000)
ON CONFLICT (seat_number) DO NOTHING;

-- ============================================
-- Row Level Security
-- Since this is an internal staff tool (single shared login),
-- we keep it simple: allow all access via the anon key for now.
-- Tighten this later if you add real staff auth.
-- ============================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all members" ON members;
CREATE POLICY "allow all members" ON members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all seats" ON seats;
CREATE POLICY "allow all seats" ON seats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow all receipts" ON receipts;
CREATE POLICY "allow all receipts" ON receipts FOR ALL USING (true) WITH CHECK (true);
