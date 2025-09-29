import { SignIn, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <main className="auth">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/login"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        appearance={{
          elements: {
            card: "auth-card auth-card--clerk",
            headerTitle: "auth-card__title",
            headerSubtitle: "auth-card__description",
            formButtonPrimary: "button button--primary auth-card__submit",
            socialButtonsBlockButton: "button button--ghost",
          },
          variables: {
            colorPrimary: "#6366f1",
            colorText: "var(--slate-700)",
            colorTextSecondary: "var(--slate-600)",
            borderRadius: "24px",
          },
        }}
      />
    </main>
  );
}
