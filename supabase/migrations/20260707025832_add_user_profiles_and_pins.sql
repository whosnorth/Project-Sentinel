-- Create table for user pins
CREATE TABLE IF NOT EXISTS sentinel_user_pins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pinned_codes TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sentinel_user_pins ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own pins" 
ON sentinel_user_pins FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pins" 
ON sentinel_user_pins FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pins" 
ON sentinel_user_pins FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Notify postgrest to reload the schema cache
NOTIFY pgrst, 'reload schema';
