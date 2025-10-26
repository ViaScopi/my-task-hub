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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    onShowHelp: () => setShowKeyboardHelp(true),
    onEscape: () => {
      setShowKeyboardHelp(false);
      setSidebarOpen(false);
    },
  });

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }

    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [sidebarOpen]);

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
    // Close sidebar on mobile when navigating
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Top Header Bar */}
      <header className="site-header">
        <div className="site-header__inner">
          {/* Menu Toggle Button */}
          {isSignedIn && (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="site-header__menu-toggle"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              <span className={`site-header__menu-line ${sidebarOpen ? 'site-header__menu-line--open' : ''}`}></span>
              <span className={`site-header__menu-line ${sidebarOpen ? 'site-header__menu-line--open' : ''}`}></span>
              <span className={`site-header__menu-line ${sidebarOpen ? 'site-header__menu-line--open' : ''}`}></span>
            </button>
          )}

          <Link href={isSignedIn ? "/dashboard" : "/"} className="site-header__brand">
            My Task Hub
          </Link>

          <div className="site-header__actions">
            {isSignedIn && (
              <>
                <button
                  type="button"
                  onClick={() => setShowKeyboardHelp(true)}
                  className="button button--ghost site-header__button"
                  aria-label="Show keyboard shortcuts"
                  title="Keyboard shortcuts (press ?)"
                >
                  ⌨️
                </button>
                <span className="site-header__user" aria-live="polite">
                  Hi, {displayName}
                </span>
              </>
            )}
            {!isSignedIn && (
              <Link href="/login" className="button button--primary site-header__button">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar Navigation */}
      {isSignedIn && (
        <>
          {/* Backdrop for mobile */}
          <div
            className={`sidebar-backdrop ${sidebarOpen ? 'sidebar-backdrop--open' : ''}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden={!sidebarOpen}
          />

          {/* Sidebar */}
          <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar__header">
              <Link href="/dashboard" className="sidebar__brand" onClick={handleNavLinkClick}>
                My Task Hub
              </Link>
            </div>

            <nav className="sidebar__nav" aria-label="Main navigation">
              {navigationLinks.map((link) => {
                const isActive = router.pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`sidebar__link${isActive ? " sidebar__link--active" : ""}`}
                    onClick={handleNavLinkClick}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="sidebar__footer">
              <button
                type="button"
                onClick={() => {
                  setShowKeyboardHelp(true);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className="sidebar__action"
              >
                <span className="sidebar__action-icon">⌨️</span>
                <span>Shortcuts</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="sidebar__action sidebar__action--logout"
              >
                <span className="sidebar__action-icon">🚪</span>
                <span>Log out</span>
              </button>
            </div>
          </aside>
        </>
      )}

      <main className={`site-content ${isSignedIn && sidebarOpen ? 'site-content--sidebar-open' : ''}`}>
        {children}
      </main>

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}
