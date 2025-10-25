-- Rename completed_tasks table to archived_tasks
-- This better represents the new workflow where completed tasks appear in Done column
-- until user explicitly archives them

-- Rename the table
ALTER TABLE completed_tasks RENAME TO archived_tasks;

-- Update the index names
ALTER INDEX idx_completed_tasks_user RENAME TO idx_archived_tasks_user;
ALTER INDEX idx_completed_tasks_lookup RENAME TO idx_archived_tasks_lookup;

-- Add archived_at column (defaults to completed_at for existing records)
ALTER TABLE archived_tasks ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT now();

-- For existing records, set archived_at to completed_at
UPDATE archived_tasks SET archived_at = completed_at WHERE archived_at IS NULL;

-- Update the RLS policy comments (policies automatically move with the table rename)
COMMENT ON POLICY "Users can view their own completed tasks" ON archived_tasks IS 'Users can view their own archived tasks';
COMMENT ON POLICY "Users can insert their own completed tasks" ON archived_tasks IS 'Users can insert their own archived tasks';
COMMENT ON POLICY "Users can update their own completed tasks" ON archived_tasks IS 'Users can update their own archived tasks';
COMMENT ON POLICY "Users can delete their own completed tasks" ON archived_tasks IS 'Users can delete their own archived tasks';
