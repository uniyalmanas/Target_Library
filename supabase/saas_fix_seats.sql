-- =================================================================
-- Multi-Tenant Seats Fix
-- Run this in Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =================================================================

-- 1. Drop the legacy single-tenant unique constraint on seat_number
ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_seat_number_key;
ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_seat_number_check;

-- 2. Add multi-tenant unique constraint (library_id + seat_number)
-- This allows every library to have its own Seat 1, Seat 2, etc.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'seats_library_seat_unique'
    ) THEN
        ALTER TABLE seats ADD CONSTRAINT seats_library_seat_unique UNIQUE (library_id, seat_number);
    END IF;
END $$;

-- 3. Seed seats for Testing Library -1 if missing
INSERT INTO seats (library_id, seat_number)
SELECT 'db56cdb5-fa33-4f9d-b92f-549250b15236', generate_series(1, 50)
ON CONFLICT (library_id, seat_number) DO NOTHING;
