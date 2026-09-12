-- ================================================================
-- LibraryOS: Custom Domain & Subdomain Routing Architecture
-- ================================================================

ALTER TABLE public.libraries
  ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_libraries_subdomain ON public.libraries(subdomain);
CREATE INDEX IF NOT EXISTS idx_libraries_custom_domain ON public.libraries(custom_domain);

-- Initial default subdomain mappings for existing tenants
UPDATE public.libraries 
SET subdomain = 'target' 
WHERE slug = 'target-library' AND subdomain IS NULL;

UPDATE public.libraries 
SET subdomain = 'demo' 
WHERE slug = 'demo-library' AND subdomain IS NULL;
