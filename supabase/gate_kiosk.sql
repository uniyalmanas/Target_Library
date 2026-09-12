-- ================================================================
-- LibraryOS: Gate Kiosk & Shift Overstay Tracker Migration
-- ================================================================

CREATE TABLE IF NOT EXISTS public.gate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  student_phone TEXT,
  seat_number INTEGER,
  subscription_type TEXT NOT NULL DEFAULT 'half_day',
  shift_type TEXT,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('in', 'out')),
  punch_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast daily gate queries and shift overstay lookups
CREATE INDEX IF NOT EXISTS idx_gate_logs_lib_punch ON public.gate_logs(library_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_gate_logs_student ON public.gate_logs(library_id, student_id, punch_time DESC);

-- Enable RLS with open service policies
ALTER TABLE public.gate_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on gate_logs" ON public.gate_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow insert on gate_logs" ON public.gate_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete on gate_logs" ON public.gate_logs
  FOR DELETE USING (true);
