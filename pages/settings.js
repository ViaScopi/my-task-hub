import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth, useSupabase } from "./_app";
import { GitHubLogo, GoogleLogo, TrelloLogo } from "../components/IntegrationLogos";

const INTEGRATIONS = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect your GitHub account to see assigned issues",
    Logo: GitHubLogo,
  },
  {
    id: "google",
    name: "Google",
    description: "Connect Google Tasks and Calendar",
    Logo: GoogleLogo,
  },
  {
    id: "trello",
    name: "Trello",
    description: "Connect your Trello boards",
    Logo: TrelloLogo,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useSupabase();

  const [integrations, setIntegrations] = useState({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [error, setError] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Load user's connected integrations
  useEffect(() => {
    if (!user) return;

    const loadIntegrations = async () => {
      try {
        const response = await fetch("/api/integrations");
        if (!response.ok) throw new Error("Failed to load integrations");

        const data = await response.json();
        const integrationsMap = {};

        data.forEach((integration) => {
          integrationsMap[integration.provider] = integration;
        });

        setIntegrations(integrationsMap);
      } catch (err) {
        console.error("Error loading integrations:", err);
        setError("Failed to load integrations");
      } finally {
        setLoadingIntegrations(false);
      }
    };

    loadIntegrations();
  }, [user]);

  const handleConnect = (provider) => {
    // Redirect to OAuth flow
    window.location.href = `/api/oauth/${provider}/authorize`;
  };

  const handleDisconnect = async (provider) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/${provider}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to disconnect");

      // Remove from state
      setIntegrations((prev) => {
        const newIntegrations = { ...prev };
        delete newIntegrations[provider];
        return newIntegrations;
      });
    } catch (err) {
      console.error("Error disconnecting:", err);
      alert("Failed to disconnect integration");
    }
  };

  if (loading || loadingIntegrations) {
    return (
      <main className="page-container">
        <h1>Settings</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <main className="page-container">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Integrations</h2>
        <p className="settings-description">
          Connect your accounts to aggregate tasks from multiple platforms
        </p>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="integrations-grid">
          {INTEGRATIONS.map((integration) => {
            const connected = Boolean(integrations[integration.id]);
            const { Logo } = integration;

            return (
              <div key={integration.id} className="integration-card">
                <div className="integration-card__icon">
                  <Logo size={48} />
                </div>
                <div className="integration-card__content">
                  <h3 className="integration-card__name">{integration.name}</h3>
                  <p className="integration-card__description">
                    {integration.description}
                  </p>

                  {connected && (
                    <p className="integration-card__status">
                      Connected as {integrations[integration.id].provider_user_email || "User"}
                    </p>
                  )}
                </div>

                <div className="integration-card__actions">
                  {connected ? (
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="button button--ghost button--small"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(integration.id)}
                      className="button button--primary button--small"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2>Account</h2>
        <div className="settings-info">
          <div className="settings-info__row">
            <span className="settings-info__label">Email:</span>
            <span className="settings-info__value">{user.email}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
