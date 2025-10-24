import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth, useSupabase } from "./_app";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useSupabase();
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const isSignedIn = Boolean(user);

  // Handle OAuth callback if code is present in URL
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if this is an OAuth callback with a code parameter
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const accessToken = hashParams.get('access_token');

      if (code && !processingOAuth) {
        setProcessingOAuth(true);
        console.log('[OAuth] Processing authorization code...');

        try {
          // Exchange code for session
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[OAuth] Error exchanging code:', error);
            router.push('/login?error=oauth_failed');
          } else {
            console.log('[OAuth] Successfully authenticated, redirecting to dashboard...');
            router.push('/dashboard');
          }
        } catch (err) {
          console.error('[OAuth] Exception during code exchange:', err);
          router.push('/login?error=oauth_failed');
        }
        return;
      }

      // Handle implicit flow (hash-based tokens)
      if (accessToken && !processingOAuth) {
        setProcessingOAuth(true);
        console.log('[OAuth] Access token found in URL hash, redirecting to dashboard...');
        // The session is already set by Supabase, just redirect
        router.push('/dashboard');
        return;
      }
    };

    handleOAuthCallback();
  }, [router, supabase, processingOAuth]);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (!loading && user && !processingOAuth) {
      router.replace("/dashboard");
    }
  }, [loading, user, router, processingOAuth]);

  // Show loading state during OAuth processing
  if (processingOAuth) {
    return (
      <main className="home">
        <section className="home__hero" style={{ textAlign: 'center' }}>
          <div className="task-state">
            <div className="task-state__spinner"></div>
            <h2 className="task-state__title">Completing sign in...</h2>
            <p className="task-state__message">Please wait while we finish authentication.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="home">
      <section className="home__hero">
        <span className="home__eyebrow">Focus. Finish. Ship.</span>
        <h1 className="home__title">Your unified command center for every task</h1>
        <p className="home__description">
          My Task Hub keeps GitHub issues, Google Tasks, and Trello cards at your fingertips.
          Sign in to see the work waiting for you, then jump into the dashboard or Kanban board
          to prioritize the next win.
        </p>
        <div className="home__actions">
          {isSignedIn ? (
            <>
              <Link href="/dashboard" className="button button--primary">
                Go to dashboard
              </Link>
              <Link href="/kanban" className="button button--ghost">
                Open Kanban board
              </Link>
            </>
          ) : (
            <Link href="/login" className="button button--primary">
              Log in to get started
            </Link>
          )}
        </div>
      </section>
      <section className="home__callout">
        <h2>What&apos;s inside?</h2>
        <ul>
          <li>Real-time dashboard with the tasks assigned to you.</li>
          <li>Kanban board to shuffle tasks between stages and keep momentum.</li>
          <li>Filters so you only see the task sources that matter right now.</li>
        </ul>
      </section>
    </main>
  );
}
