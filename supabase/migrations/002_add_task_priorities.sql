-- Task priorities table
-- Store user-assigned priorities for tasks from any source
create table task_priorities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  original_id text not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, source, original_id)
);

-- Create indexes for performance
create index idx_task_priorities_lookup on task_priorities(user_id, source, original_id);
create index idx_task_priorities_user on task_priorities(user_id, created_at desc);

-- Enable Row Level Security
alter table task_priorities enable row level security;

-- RLS Policies for task_priorities
create policy "Users can view their own task priorities"
  on task_priorities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own task priorities"
  on task_priorities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own task priorities"
  on task_priorities for update
  using (auth.uid() = user_id);

create policy "Users can delete their own task priorities"
  on task_priorities for delete
  using (auth.uid() = user_id);

-- Trigger to update updated_at automatically
create trigger update_task_priorities_updated_at
  before update on task_priorities
  for each row
  execute function update_updated_at_column();
