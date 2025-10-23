# Migration Guide: Clerk to Supabase Auth

This guide documents the transformation of My Task Hub from a single-user application to a multi-user SaaS application.

## What Changed

### Authentication
- **Before**: Clerk authentication with hardcoded personal API tokens
- **After**: Supabase Auth with per-user OAuth integrations

### Architecture
- **Before**: Single user, personal environment variables for all integrations
- **After**: Multi-user, each user connects their own integrations

## Key Changes

### 1. Authentication System
- Replaced `@clerk/nextjs` with `@supabase/supabase-js` and `@supabase/ssr`
- Updated `_app.js` to use Supabase Auth Context
- Updated `Layout.js` to use Supabase user state
- Created new login page with email/password authentication

### 2. Database Schema
Added Supabase tables:
- `user_integrations` - Stores OAuth tokens per user
- `completed_tasks` - User-specific completed tasks (replaces JSON file)
- `user_preferences` - User settings
- `task_notes` - Optional notes on tasks

### 3. OAuth Flows
Created OAuth handlers for:
- **GitHub**: `/api/oauth/github/authorize` and `/api/oauth/github/callback`
- **Google**: `/api/oauth/google/authorize` and `/api/oauth/google/callback`
- **Trello**: `/api/oauth/trello/authorize` and `/api/oauth/trello/callback`

### 4. Updated API Endpoints
- `/api/github.js` - Now uses per-user GitHub tokens from database
- `/api/google-tasks.js` - Now uses per-user Google tokens with auto-refresh
- `/api/trello.js` - Now uses per-user Trello tokens from database
- `/api/google-calendar.js` - Now uses per-user Google tokens with auto-refresh
- `/api/completed-tasks.js` - Now uses Supabase database instead of JSON file

### 5. New Pages
- `/pages/settings.js` - Integration management page
- `/pages/login.js` - New auth page
- `/pages/auth/callback.js` - Email confirmation handler

### 6. Helper Utilities
- `/lib/supabase/client.js` - Browser Supabase client
- `/lib/supabase/api.js` - API routes Supabase client
- `/lib/supabase/middleware.js` - Auth middleware
- `/lib/google-auth.js` - Google token refresh logic

## Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the migration SQL from `supabase/migrations/001_initial_schema.sql`
3. Get your Project URL and API keys from Settings > API

### 2. Configure Environment Variables in Vercel
Add environment variables in Vercel dashboard (Settings > Environment Variables):
- Supabase credentials
- OAuth app credentials (GitHub, Google, Trello)
- Application URL: `https://my-task-hub-rosy.vercel.app`

For local development, copy `.env.example` to `.env.local`.

### 3. Set Up OAuth Apps

**Production URLs** (for Vercel deployment at `https://my-task-hub-rosy.vercel.app`):

#### GitHub
1. Go to https://github.com/settings/developers
2. Create new OAuth App or update existing
3. Set homepage URL: `https://my-task-hub-rosy.vercel.app`
4. Set callback URL: `https://my-task-hub-rosy.vercel.app/api/oauth/github/callback`
5. Copy Client ID and Secret

#### Google
1. Go to https://console.cloud.google.com/
2. Create project and enable Google Tasks API + Calendar API
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI: `https://my-task-hub-rosy.vercel.app/api/oauth/google/callback`
5. Add authorized JavaScript origin: `https://my-task-hub-rosy.vercel.app`
6. Copy Client ID and Secret

#### Trello
1. Go to https://trello.com/power-ups/admin
2. Create new Power-Up to get API key
3. Copy API Key

**For Local Development** (optional):
- Create separate OAuth apps with `http://localhost:3000` URLs
- Use different environment variables for development

### 4. Deploy to Vercel
The app is already deployed at: https://my-task-hub-rosy.vercel.app

For updates:
```bash
git push origin <branch-name>
# Vercel will auto-deploy
```

### 5. User Flow
1. Visit https://my-task-hub-rosy.vercel.app/login
2. Sign up with email and password
3. Go to `/settings` to connect integrations
4. Click "Connect GitHub/Google/Trello"
5. Complete OAuth flow (tokens are stored in Supabase)
6. Access `/dashboard` to see integrated tasks

## Migration for Existing Data

If you had completed tasks in JSON files:
- Create a migration script to import them into Supabase
- Match tasks to user IDs
- Insert into `completed_tasks` table

## Benefits

### For Users
- Each user has their own account and data
- Connect personal GitHub, Google, Trello accounts
- Data isolation and security via RLS
- Scalable to multiple users

### For Development
- No more hardcoded credentials
- Better security (Row Level Security)
- Easier to test with multiple accounts
- Production-ready architecture

## Remaining Work

### High Priority
✅ All high-priority tasks completed! The migration to Supabase is now complete:
1. ✅ Complete Trello API endpoint migration
2. ✅ Complete Google Calendar API endpoint migration  
3. ✅ Migrate completed tasks storage from JSON to Supabase
4. ✅ Add CSS styling for new auth pages and settings page
5. ✅ Fix Trello OAuth to handle token from URL fragment

### Medium Priority
1. Add password reset functionality
2. Add email verification
3. Improve error handling and user feedback
4. Add loading states
5. Token encryption for stored OAuth tokens

### Nice to Have
1. Social sign-in (GitHub, Google OAuth for auth, not just integrations)
2. Team workspaces
3. Task sharing
4. Analytics dashboard
5. Export data functionality

## Troubleshooting

### OAuth Errors
- Verify callback URLs match exactly in OAuth app settings
- Check that all required scopes are requested
- Ensure environment variables are set correctly

### Token Refresh Issues
- Google tokens should auto-refresh via `lib/google-auth.js`
- If refresh fails, user needs to reconnect integration
- Check that `GOOGLE_OAUTH_CLIENT_SECRET` is set

### Database Errors
- Verify RLS policies are set up correctly
- Check that user is authenticated before API calls
- Ensure foreign key relationships are intact

## Security Considerations

1. **Token Storage**: OAuth tokens are stored in plaintext in database. Consider encrypting in production.
2. **RLS Policies**: All tables have Row Level Security enabled - test thoroughly
3. **API Keys**: Never commit `.env.local` to version control
4. **CORS**: Configure appropriate CORS headers for production
5. **Rate Limiting**: Consider adding rate limiting to API endpoints

## Questions?

Check the following files for reference:
- `supabase/README.md` - Detailed Supabase setup
- `docs/authentication.md` - Original Clerk auth docs (now outdated)
- Database schema: `supabase/migrations/001_initial_schema.sql`
