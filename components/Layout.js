import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "Home", requiresAuth: false },
  { href: "/dashboard", label: "Dashboard", requiresAuth: true },
  { href: "/kanban", label: "Kanban Board", requiresAuth: true },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const navigationLinks = useMemo(() => {
    return NAV_LINKS.filter((link) => (link.requiresAuth ? Boolean(user) : true));
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

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
            {user ? (
              <>
                <span className="site-header__user" aria-live="polite">
                  Hi, {user.name}
                </span>
                <button
                  type="button"
                  className="button button--ghost site-header__button"
                  onClick={handleLogout}
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
    </div>
  );
}
