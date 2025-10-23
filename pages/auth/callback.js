import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSupabase } from "../_app";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("Error confirming email:", error);
        router.push("/login?error=confirmation_failed");
      } else {
        router.push("/dashboard");
      }
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <main className="auth">
      <div className="auth-card">
        <h1 className="auth-card__title">Confirming your email...</h1>
        <p className="auth-card__description">Please wait while we verify your account.</p>
      </div>
    </main>
  );
}
