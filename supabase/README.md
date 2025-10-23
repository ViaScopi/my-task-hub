# Supabase Setup Instructions

This guide will help you set up the Supabase database for My Task Hub.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in the details:
   - **Name**: my-task-hub (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to your users
5. Click "Create new project"

## 2. Run the Database Migration

1. In your Supabase dashboard, go to the **SQL Editor**
2. Click "New Query"
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

This will create all necessary tables, indexes, RLS policies, and triggers.

## 3. Get Your API Keys

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`) - Keep this secret!

## 4. Configure Environment Variables in Vercel

Add environment variables in your Vercel project dashboard:

1. Go to https://vercel.com/your-username/my-task-hub-rosy
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OAuth App Credentials (for integrations)
# GitHub OAuth App
GITHUB_OAUTH_CLIENT_ID=your-github-oauth-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-oauth-client-secret

# Google OAuth App
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret

# Trello OAuth App
TRELLO_API_KEY=your-trello-api-key

# Application URL (for OAuth callbacks)
NEXT_PUBLIC_APP_URL=https://my-task-hub-rosy.vercel.app
```

4. After adding variables, redeploy the app for changes to take effect

**For Local Development**: Copy `.env.example` to `.env.local` and use `http://localhost:3000` as the app URL.

## 5. Set Up OAuth Apps

You'll need to create OAuth applications for each integration using your **production URL**:

### GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App" or update existing
3. Fill in:
   - **Application name**: My Task Hub
   - **Homepage URL**: `https://my-task-hub-rosy.vercel.app`
   - **Authorization callback URL**: `https://my-task-hub-rosy.vercel.app/api/oauth/github/callback`
4. Copy the Client ID and generate a Client Secret
5. Add these to Vercel environment variables

### Google OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs: Google Tasks API, Google Calendar API
4. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
5. Configure consent screen if prompted
6. Choose "Web application"
7. Add authorized JavaScript origins:
   - `https://my-task-hub-rosy.vercel.app`
8. Add authorized redirect URIs:
   - `https://my-task-hub-rosy.vercel.app/api/oauth/google/callback`
9. Copy the Client ID and Client Secret
10. Add these to Vercel environment variables

### Trello OAuth App
1. Go to [Trello Power-Ups](https://trello.com/power-ups/admin)
2. Click "New" to create a new Power-Up
3. Fill in the details and get your API Key
4. Add the API Key to Vercel environment variables

**Note**: For local development, create separate OAuth apps with `http://localhost:3000` URLs.

## 6. Configure Supabase Auth Providers (Optional)

If you want to offer social sign-in (in addition to email/password):

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Enable desired providers (GitHub, Google, etc.)
3. Add the OAuth credentials
4. Configure redirect URLs

## 7. Test the Setup

### Production (Vercel):
1. Visit https://my-task-hub-rosy.vercel.app
2. Try signing up with a new account
3. Go to `/settings` and connect an integration
4. Check Supabase dashboard > Authentication > Users to verify
5. Check Supabase dashboard > Database > user_integrations to see stored tokens

### Local Development (optional):
1. Start your development server: `npm run dev`
2. Visit `http://localhost:3000`
3. Test sign-up and OAuth flows
4. Use separate OAuth apps with localhost URLs

## Database Schema Overview

- **user_integrations**: Stores OAuth tokens for GitHub, Google, Trello, Fellow
- **completed_tasks**: User-specific completed task history
- **user_preferences**: User settings (theme, default view, etc.)
- **task_notes**: Rich notes users can add to tasks

## Security Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data
- OAuth tokens are stored in the database (consider encrypting in production)
- Never commit `.env.local` to version control
- Use environment variables for all secrets
