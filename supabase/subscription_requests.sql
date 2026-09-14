-- =================================================================
-- SaaS Subscription Verification & Payment Requests Table
-- Enables library owners to submit payment screenshots for UPI verification
-- =================================================================

CREATE TABLE IF NOT EXISTS subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    library_slug VARCHAR(100) NOT NULL,
    library_name VARCHAR(255) NOT NULL,
    amount INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL DEFAULT 'Flat Monthly Pro (₹599)',
    billing_period_days INT NOT NULL DEFAULT 30,
    screenshot_url TEXT NOT NULL,
    utr_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_library ON subscription_requests(library_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_slug ON subscription_requests(library_slug);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON subscription_requests(status);
