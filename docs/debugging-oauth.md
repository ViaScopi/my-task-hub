# Debugging Trello OAuth Callback

## Issue: Callback completes successfully but no row in database

### Enhanced Logging

The callback handler now has comprehensive logging. After attempting the OAuth flow, check your Vercel logs for these messages:

```
[Trello Callback] Starting callback handler
[Trello Callback] Token present: true/false
[Trello Callback] State: <user-id>
[Trello Callback] Auth check - User ID: <user-id>
[Trello Callback] Auth error: null
[Trello Callback] Fetching Trello user info
[Trello Callback] Trello user: { id, username, email }
[Trello Callback] Attempting to insert/update integration for user: <user-id>
[Trello Callback] Database operation result: { error, data, hasData, dataLength }
[Trello Callback] Successfully stored integration
```

### Common Issues to Check

1. **Database Migration Not Run**
   - Check if the `user_integrations` table exists in your Supabase dashboard
   - Go to: Supabase Dashboard → SQL Editor → Run the migration from `supabase/migrations/001_initial_schema.sql`

2. **RLS Policies**
   - The migration creates RLS policies that require `auth.uid() = user_id`
   - Check if the authenticated user's ID matches what's being inserted
   - Look for the log line: `[Trello Callback] Auth check - User ID:`

3. **Authentication Context**
   - The Supabase client needs to have the user's session cookies
   - If the user ID is logged but the insert fails, the session might not be properly set

4. **Database Permissions**
   - Verify the anon key has permission to insert with RLS enabled
   - The policies should allow inserts where `auth.uid() = user_id`

### Verification Steps

1. **Check Database Schema**
   ```bash
   node scripts/verify-db.js
   ```

2. **Check Vercel Logs**
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter by the time you attempted the OAuth flow
   - Look for `[Trello Callback]` messages

3. **Check Supabase Logs**
   - Go to Supabase Dashboard → Logs → API Logs
   - Look for failed INSERT operations on `user_integrations`

4. **Manual Database Query**
   In Supabase SQL Editor:
   ```sql
   -- Check if table exists
   SELECT * FROM user_integrations;

   -- Check RLS policies
   SELECT * FROM pg_policies WHERE tablename = 'user_integrations';

   -- Check if your user exists in auth
   SELECT id, email FROM auth.users;
   ```

### Expected Log Patterns

**Success Pattern:**
```
[Trello Callback] Database operation result: {
  error: null,
  data: [{ id: 'uuid', user_id: 'uuid', provider: 'trello', ... }],
  hasData: true,
  dataLength: 1
}
```

**Failure Pattern (Table doesn't exist):**
```
[Trello Callback] Database error details: {
  code: "42P01",
  message: "relation \"user_integrations\" does not exist"
}
```

**Failure Pattern (RLS blocking):**
```
[Trello Callback] Database operation result: {
  error: { code: "42501", message: "new row violates row-level security policy" },
  data: null,
  hasData: false,
  dataLength: undefined
}
```

### Next Steps

After running the OAuth flow again:
1. Check Vercel logs for the `[Trello Callback]` messages
2. Share the log output to identify the specific issue
3. Verify the database has the schema by running the verification script
