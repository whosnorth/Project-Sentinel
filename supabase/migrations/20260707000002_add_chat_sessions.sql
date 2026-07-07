-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS sentinel_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES sentinel_events(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS sentinel_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sentinel_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB,
    is_investigated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sentinel_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for sentinel_chat_sessions
CREATE POLICY "Users can view their own chat sessions"
ON sentinel_chat_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat sessions"
ON sentinel_chat_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
ON sentinel_chat_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
ON sentinel_chat_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policies for sentinel_chat_messages
CREATE POLICY "Users can view their own chat messages"
ON sentinel_chat_messages FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM sentinel_chat_sessions 
    WHERE sentinel_chat_sessions.id = sentinel_chat_messages.session_id 
    AND sentinel_chat_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own chat messages"
ON sentinel_chat_messages FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM sentinel_chat_sessions 
    WHERE sentinel_chat_sessions.id = sentinel_chat_messages.session_id 
    AND sentinel_chat_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can update their own chat messages"
ON sentinel_chat_messages FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM sentinel_chat_sessions 
    WHERE sentinel_chat_sessions.id = sentinel_chat_messages.session_id 
    AND sentinel_chat_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own chat messages"
ON sentinel_chat_messages FOR DELETE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM sentinel_chat_sessions 
    WHERE sentinel_chat_sessions.id = sentinel_chat_messages.session_id 
    AND sentinel_chat_sessions.user_id = auth.uid()
));

-- Trigger for updating `updated_at` on sessions
CREATE OR REPLACE FUNCTION update_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sentinel_chat_sessions_modtime
BEFORE UPDATE ON sentinel_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_chat_session_updated_at();

-- Trigger to update session `updated_at` when a new message is inserted
CREATE OR REPLACE FUNCTION touch_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sentinel_chat_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_sentinel_chat_session
AFTER INSERT ON sentinel_chat_messages
FOR EACH ROW
EXECUTE FUNCTION touch_chat_session_on_message();
