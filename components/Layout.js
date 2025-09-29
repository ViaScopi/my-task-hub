import { SignedIn, SignedOut, SignOutButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home", requiresAuth: false },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
  { href: "/calendar", label: "Calendar", requiresAuth: true },
  { href: "/kanban", label: "Kanban Board", requiresAuth: true },
];

export default function Layout({ children }) {
  const { user, isSignedIn } = useUser();
  const router = useRouter();

  const navigationLinks = useMemo(() => {
    return NAV_LINKS.filter((link) => (link.requiresAuth ? Boolean(isSignedIn) : true));
  }, [isSignedIn]);

  const displayName = useMemo(() => {
    if (!user) {
      return "there";
    }

    return (
      user.fullName ||
      user.firstName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "there"
    );
  }, [user]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-header__brand">
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
            <SignedIn>
              <span className="site-header__user" aria-live="polite">
                Hi, {displayName}
              </span>
              <SignOutButton signOutRedirectUrl="/">
                <button type="button" className="button button--ghost site-header__button">
                  Log out
                </button>
              </SignOutButton>
            </SignedIn>
            <SignedOut>
              <Link href="/login" className="button button--primary site-header__button">
                Log in
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      <div className="site-content">{children}</div>
    </div>
  );
}
