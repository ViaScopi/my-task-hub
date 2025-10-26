import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    onShowHelp: () => setShowKeyboardHelp(true),
    onEscape: () => {
      setShowKeyboardHelp(false);
      setMobileMenuOpen(false);
    },
  });

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }

    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [mobileMenuOpen]);

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

  const handleNavLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href={isSignedIn ? "/dashboard" : "/"} className="site-header__brand">
            My Task Hub
          </Link>

          {/* Desktop Navigation */}
          <nav className="site-nav site-nav--desktop" aria-label="Main navigation">
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
                <span className="site-header__user site-header__user--desktop" aria-live="polite">
                  Hi, {displayName}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="button button--ghost site-header__button site-header__button--desktop"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" className="button button--primary site-header__button">
                Log in
              </Link>
            )}

            {/* Hamburger Menu Button */}
            {isSignedIn && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="site-header__hamburger"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                <span className={`site-header__hamburger-line ${mobileMenuOpen ? 'site-header__hamburger-line--open' : ''}`}></span>
                <span className={`site-header__hamburger-line ${mobileMenuOpen ? 'site-header__hamburger-line--open' : ''}`}></span>
                <span className={`site-header__hamburger-line ${mobileMenuOpen ? 'site-header__hamburger-line--open' : ''}`}></span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isSignedIn && (
        <>
          <div
            className={`site-nav-mobile-backdrop ${mobileMenuOpen ? 'site-nav-mobile-backdrop--open' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden={!mobileMenuOpen}
          />
          <nav
            className={`site-nav-mobile ${mobileMenuOpen ? 'site-nav-mobile--open' : ''}`}
            aria-label="Mobile navigation"
          >
            <div className="site-nav-mobile__header">
              <span className="site-nav-mobile__user">Hi, {displayName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="site-nav-mobile__close"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="site-nav-mobile__links">
              {navigationLinks.map((link) => {
                const isActive = router.pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`site-nav-mobile__link${isActive ? " site-nav-mobile__link--active" : ""}`}
                    onClick={handleNavLinkClick}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="site-nav-mobile__footer">
              <button
                type="button"
                onClick={() => {
                  setShowKeyboardHelp(true);
                  setMobileMenuOpen(false);
                }}
                className="button button--ghost button--block"
              >
                ⌨️ Keyboard Shortcuts
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="button button--ghost button--block"
              >
                Log out
              </button>
            </div>
          </nav>
        </>
      )}

      <div className="site-content">{children}</div>

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}
