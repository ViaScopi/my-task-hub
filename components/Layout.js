import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useAuth } from "../pages/_app";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";

const NAV_LINKS = [
  { href: "/", label: "Home", requiresAuth: false, hideWhenAuth: true },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
  { href: "/today", label: "Today", requiresAuth: true },
  { href: "/focus", label: "Focus", requiresAuth: true },
  { href: "/analytics", label: "Analytics", requiresAuth: true },
  { href: "/calendar", label: "Calendar", requiresAuth: true },
  { href: "/kanban", label: "Kanban Board", requiresAuth: true },
  { href: "/archived", label: "Archive", requiresAuth: true },
  { href: "/settings", label: "Settings", requiresAuth: true },
];

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const isSignedIn = Boolean(user);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    onShowHelp: () => setShowKeyboardHelp(true),
    onEscape: () => setShowKeyboardHelp(false),
  });

  const navigationLinks = useMemo(() => {
    return NAV_LINKS.filter((link) => {
      // Hide links that require auth when not signed in
      if (link.requiresAuth && !isSignedIn) return false;
      // Hide links that should be hidden when authenticated
      if (link.hideWhenAuth && isSignedIn) return false;
      return true;
    });
  }, [isSignedIn]);

  const displayName = useMemo(() => {
    if (!user) {
      return "there";
    }

    // Use user metadata if available
    const metadata = user.user_metadata || {};
    return (
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "there"
    );
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href={isSignedIn ? "/dashboard" : "/"} className="site-header__brand">
            My Task Hub
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            {navigationLinks.map((link) => {
              const isActive = router.pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`site-nav__link${isActive ? " site-nav__link--active" : ""}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="site-header__actions">
            {isSignedIn && (
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(true)}
                className="button button--ghost site-header__button site-header__keyboard-btn"
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (press ?)"
              >
                ⌨️
              </button>
            )}
            {isSignedIn ? (
              <>
                <span className="site-header__user" aria-live="polite">
                  Hi, {displayName}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="button button--ghost site-header__button"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" className="button button--primary site-header__button">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="site-content">{children}</div>

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}
