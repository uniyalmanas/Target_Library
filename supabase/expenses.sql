-- Expenses Schema for LibraryOS
-- Tracks operational costs (Electricity, Rent, Wi-Fi, Water, Staff, Maintenance)
-- Enables Net In-Hand Profit calculation: Collections - Expenses

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'misc', -- 'electricity', 'rent', 'wifi', 'water_tea', 'staff_salary', 'maintenance', 'misc'
  amount NUMERIC(10, 2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'online', 'upi'
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient date and library queries
CREATE INDEX IF NOT EXISTS idx_expenses_library_date ON expenses(library_id, expense_date);
