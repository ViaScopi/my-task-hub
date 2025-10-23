-- My Task Hub Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User integrations table
-- Stores OAuth tokens and connection info for external services
create table user_integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('github', 'google', 'trello', 'fellow')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamp with time zone,
  scopes text[],
  provider_user_id text,
  provider_user_email text,
  metadata jsonb default '{}'::jsonb,
  connected_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, provider)
);

-- Completed tasks table
-- Replaces the JSON file storage for completed tasks
create table completed_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  original_id text not null,
  title text not null,
  description text,
  status text not null,
  completed_at timestamp with time zone not null,
  notes text,
  url text,
  repo text,
  pipeline_id text,
  pipeline_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  unique(user_id, source, original_id)
);

-- User preferences table
-- Store user-specific settings
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_view text default 'dashboard' check (default_view in ('dashboard', 'kanban', 'calendar')),
  theme text default 'light' check (theme in ('light', 'dark', 'system')),
  notifications_enabled boolean default true,
  google_tasks_list_ids text[],
  preferences jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Task notes table
-- Add rich notes to any task
create table task_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  original_id text not null,
  note text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_user_integrations_user_provider on user_integrations(user_id, provider);
create index idx_completed_tasks_user on completed_tasks(user_id, completed_at desc);
create index idx_completed_tasks_lookup on completed_tasks(user_id, source, original_id);
create index idx_task_notes_lookup on task_notes(user_id, source, original_id);
create index idx_task_notes_created on task_notes(user_id, created_at desc);

-- Enable Row Level Security on all tables
alter table user_integrations enable row level security;
alter table completed_tasks enable row level security;
alter table user_preferences enable row level security;
alter table task_notes enable row level security;

-- RLS Policies for user_integrations
create policy "Users can view their own integrations"
  on user_integrations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own integrations"
  on user_integrations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own integrations"
  on user_integrations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own integrations"
  on user_integrations for delete
  using (auth.uid() = user_id);

-- RLS Policies for completed_tasks
create policy "Users can view their own completed tasks"
  on completed_tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own completed tasks"
  on completed_tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own completed tasks"
  on completed_tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own completed tasks"
  on completed_tasks for delete
  using (auth.uid() = user_id);

-- RLS Policies for user_preferences
create policy "Users can view their own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on user_preferences for delete
  using (auth.uid() = user_id);

-- RLS Policies for task_notes
create policy "Users can view their own task notes"
  on task_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own task notes"
  on task_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own task notes"
  on task_notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own task notes"
  on task_notes for delete
  using (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to update updated_at automatically
create trigger update_user_integrations_updated_at
  before update on user_integrations
  for each row
  execute function update_updated_at_column();

create trigger update_user_preferences_updated_at
  before update on user_preferences
  for each row
  execute function update_updated_at_column();

create trigger update_task_notes_updated_at
  before update on task_notes
  for each row
  execute function update_updated_at_column();

-- Function to create default user preferences on signup
create or replace function create_default_preferences()
returns trigger as $$
begin
  insert into user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create default preferences when a user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function create_default_preferences();
