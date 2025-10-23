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
        </form>
      </div>
    </main>
  );
}
