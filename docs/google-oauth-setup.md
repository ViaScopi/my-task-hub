# Google OAuth Configuration Guide

This guide explains how to properly configure Google OAuth for authentication (sign-in) in My Task Hub.

## Important: Two Different Google Integrations

My Task Hub uses Google in **two different ways**:

1. **Google OAuth for Authentication** (Sign in with Google) - This guide
2. **Google Tasks/Calendar Integration** (Access user's tasks/calendar) - Different setup

They require different OAuth configurations!

## Setting Up Google OAuth for Authentication

### Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: "My Task Hub - Authentication" (or similar)

5. **Configure Authorized redirect URIs** - Add BOTH:
   ```
   https://<your-supabase-project>.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback  (for local development)
   ```

   **Important Notes:**
   - ❌ Do NOT add your app URL (e.g., `myapp.vercel.app/auth/callback`)
   - ✅ DO use your Supabase project's auth callback URL
   - The Supabase URL format is: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Find your project ref in Supabase Dashboard → Settings → API

6. **Configure Authorized JavaScript origins** - Add:
   ```
   http://localhost:3000  (for local development)
   https://your-app.vercel.app  (your production app)
   ```

7. Click **Create** and copy:
   - Client ID
   - Client Secret

### Step 2: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to enable it

5. **Enter credentials:**
   - Client ID: (from Google Console)
   - Client Secret: (from Google Console)

6. **Site URL Configuration:**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL** to your production app URL:
     ```
     https://my-task-hub-rosy.vercel.app
     ```
   - For local development, you can set it to:
     ```
     http://localhost:3000
     ```

7. **Redirect URLs:**
   - Add to **Redirect URLs** list:
     ```
     http://localhost:3000
     https://my-task-hub-rosy.vercel.app
     ```

8. Click **Save**

### Step 3: Test the Integration

#### Local Testing (Development)
1. Set Site URL in Supabase to `http://localhost:3000`
2. Run your app locally: `npm run dev`
3. Go to `http://localhost:3000/login`
4. Click "Continue with Google"
5. You should be redirected to Google login
6. After signing in, you should be redirected back to `http://localhost:3000/?code=...`
7. The app will automatically exchange the code for a session and redirect to dashboard

#### Production Testing
1. Set Site URL in Supabase to `https://my-task-hub-rosy.vercel.app`
2. Deploy your app to Vercel
3. Go to your production URL + `/login`
4. Click "Continue with Google"
5. Should work the same way as local

## Troubleshooting

### Issue: "redirect_uri_mismatch" error
**Cause:** The redirect URI in Google Console doesn't match what Supabase is using.

**Solution:**
- Make sure you added the Supabase auth callback URL (not your app URL) to Google Console
- Format: `https://<project-ref>.supabase.co/auth/v1/callback`

### Issue: Redirects to root with code but doesn't log in
**Cause:** The OAuth callback code exchange might be failing.

**Solution:**
- Check browser console for `[OAuth]` log messages
- Ensure Site URL in Supabase matches where you're being redirected
- Verify the code exchange is happening in the home page component

### Issue: "Invalid redirect URL" from Supabase
**Cause:** The redirect URL is not in Supabase's allowed list.

**Solution:**
- Add your app URL to **Redirect URLs** in Supabase → Authentication → URL Configuration
- Make sure Site URL is set correctly

### Issue: Works locally but not in production
**Cause:** Site URL or redirect URLs not configured for production.

**Solution:**
- Update Site URL in Supabase to production URL
- Add production URL to Redirect URLs list
- Verify Google Console has both local and production redirect URIs

## Environment Variables

Make sure these are set in your environment (Vercel/local):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## How It Works

1. User clicks "Continue with Google" on `/login`
2. App calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. User is redirected to Google's OAuth consent screen
4. After consent, Google redirects to Supabase's callback URL with an authorization code
5. Supabase exchanges the code and redirects to your Site URL with a code parameter
6. Your app's home page (`/`) detects the code and exchanges it for a session
7. User is redirected to `/dashboard`

## Key URLs to Remember

- **Google OAuth Redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback`
- **Your App Redirect**: `https://your-app.vercel.app` (set as Site URL in Supabase)
- **After OAuth**: User lands at your app root with `?code=...` parameter

## Difference from Integration OAuth

This Google OAuth is ONLY for authentication (signing in users).

If you want to access user's Google Tasks or Calendar (integration), that uses a different OAuth setup with the endpoints:
- `/api/oauth/google/authorize`
- `/api/oauth/google/callback`

Those are configured separately and require different scopes!
