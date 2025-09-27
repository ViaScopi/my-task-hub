import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter your name to continue.");
      return;
    }

    login(name);
    router.push("/dashboard");
  };

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Log in to My Task Hub</h1>
        <p>We&apos;ll remember you on this device until you log out.</p>

        <label htmlFor="login-name" className="auth-card__label">
          Display name
        </label>
        <input
          id="login-name"
          type="text"
          className="auth-card__input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Jane Doe"
          autoComplete="name"
        />
        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="button button--primary auth-card__submit">
          Continue
        </button>
      </form>
    </main>
  );
}
