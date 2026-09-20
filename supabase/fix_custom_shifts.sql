-- ==========================================================
-- Fix for Custom Shifts in Receipts Table
-- Drops legacy check constraint so any dynamic shift ID can be booked.
-- Widens shift_type column to VARCHAR(100).
-- Run this in Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> paste -> Run
-- ==========================================================

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_shift_type_check;
ALTER TABLE receipts ALTER COLUMN shift_type TYPE VARCHAR(100);
