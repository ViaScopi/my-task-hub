-- Add time estimates and today flags to task management
-- This supports ADHD-focused features: time awareness and daily focus

-- Create a task_metadata table to store time estimates and today flags
CREATE TABLE IF NOT EXISTS task_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL,
  original_id TEXT NOT NULL,
  time_estimate INTEGER, -- in minutes
  is_today BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, source, original_id)
);

-- Create index for fast lookups
CREATE INDEX idx_task_metadata_lookup ON task_metadata(user_id, source, original_id);
CREATE INDEX idx_task_metadata_today ON task_metadata(user_id, is_today) WHERE is_today = true;

-- Enable RLS
ALTER TABLE task_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own task metadata"
  ON task_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task metadata"
  ON task_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task metadata"
  ON task_metadata FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task metadata"
  ON task_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at automatically
CREATE TRIGGER update_task_metadata_updated_at
  BEFORE UPDATE ON task_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
