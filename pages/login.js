import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth, useSupabase } from "./_app";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          // Email already exists
          setError("An account with this email already exists. Please sign in instead.");
        } else {
          setMessage("Check your email for the confirmation link!");
        }
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Redirect will happen automatically via useEffect
        router.push("/dashboard");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <main className="auth">
        <div className="auth-card">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1 className="auth-card__title">
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>
        <p className="auth-card__description">
          {isSignUp
            ? "Sign up to start managing your tasks"
            : "Sign in to access your task dashboard"}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-message auth-message--error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-message auth-message--success" role="status">
              {message}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
              minLength={6}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="button button--primary button--full"
            disabled={submitting}
          >
            {submitting ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider__text">or</span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="button button--google button--full"
          disabled={submitting}
        >
          <svg className="button__icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-toggle">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setMessage("");
            }}
            className="auth-toggle__link"
            disabled={submitting}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  );
}
