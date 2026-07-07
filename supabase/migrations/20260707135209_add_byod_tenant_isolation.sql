-- Add organization_id for BYOD tenant isolation
ALTER TABLE public.sentinel_events ADD COLUMN organization_id UUID NULL;

-- Add is_proprietary flag for easy UI filtering
ALTER TABLE public.sentinel_events ADD COLUMN is_proprietary BOOLEAN NOT NULL DEFAULT false;

-- Create an index for faster tenant filtering
CREATE INDEX idx_sentinel_events_organization_id ON public.sentinel_events(organization_id);

-- Update Row Level Security (RLS) on sentinel_events
-- We need to drop the existing permissive policy and replace it with tenant-aware policies

-- Drop existing public read policy if it exists (assuming it was named 'Enable read access for all users')
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sentinel_events;

-- Policy 1: Everyone can read public OSINT data (organization_id IS NULL)
CREATE POLICY "Enable public read for OSINT events" ON public.sentinel_events
    FOR SELECT
    TO public
    USING (organization_id IS NULL);

-- Policy 2: Authenticated users can read their own organization's proprietary data
-- Note: the auth.jwt() -> 'user_roles' ->> 'organization_id' is an example. For this hackathon app, 
-- we will use a simplified check or assume the UI filters by the mocked auth state.
-- For a real deployment, we'd check auth.uid() against a user_profiles table.
CREATE POLICY "Enable tenant read for BYOD events" ON public.sentinel_events
    FOR SELECT
    TO authenticated
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Allow authenticated users (e.g. edge functions) to insert proprietary data
CREATE POLICY "Enable edge function inserts" ON public.sentinel_events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
