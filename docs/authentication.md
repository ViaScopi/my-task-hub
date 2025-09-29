# Authentication setup

This project now uses [Clerk](https://clerk.com/) for authentication. To run the app locally you
must configure Clerk and provide the required environment variables.

## Required environment variables

Create a Clerk application and copy the keys into a `.env.local` file in the project root:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Restart the development server after adding or updating the keys so the Next.js runtime can pick up
the new values.

## Development tips

- The `/login` route renders Clerk's `<SignIn />` component styled to match the existing UI.
- Protected pages such as `/dashboard` and `/kanban` use Clerk's `<SignedIn />` and `<SignedOut />`
  wrappers to toggle content based on the authentication state.
- The site header shows the signed-in user's name when available and uses Clerk's sign-out flow to
  clear the session and redirect back to the homepage.

Refer to Clerk's documentation for additional customization options, including social providers and
localization settings.
