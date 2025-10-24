import { useState, useEffect } from "react";
import { createClient } from "../lib/supabase/client";
import "../styles/globals.css";
import Layout from "../components/Layout";

// Create a context for Supabase and Auth
import { createContext, useContext } from "react";

export const SupabaseContext = createContext(null);
export const AuthContext = createContext(null);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return context;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session loaded:', session ? 'authenticated' : 'not authenticated');
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, session ? 'authenticated' : 'not authenticated');
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const authValue = {
    user,
    loading,
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <SupabaseContext.Provider value={supabase}>
      <AuthContext.Provider value={authValue}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AuthContext.Provider>
    </SupabaseContext.Provider>
  );
}
