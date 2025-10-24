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
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendars, setSelectedCalendars] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);

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

  // Load available Google calendars
  useEffect(() => {
    if (!user || !integrations.google) return;

    const loadCalendars = async () => {
      setLoadingCalendars(true);
      setError(""); // Clear any previous errors
      try {
        const [calendarsRes, prefsRes] = await Promise.all([
          fetch("/api/google-calendars"),
          fetch("/api/user-preferences"),
        ]);

        console.log("Calendar fetch response:", {
          status: calendarsRes.status,
          ok: calendarsRes.ok
        });

        if (calendarsRes.ok) {
          const calendarsData = await calendarsRes.json();
          console.log("Calendars data:", calendarsData);
          setCalendars(calendarsData || []);
        } else {
          const errorData = await calendarsRes.json().catch(() => ({}));
          console.error("Failed to fetch calendars:", errorData);
          setError(`Failed to load calendars: ${errorData.details || errorData.error || "Unknown error"}`);
        }

        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          const savedCalendarIds = prefsData?.preferences?.google_calendar_ids || [];
          setSelectedCalendars(savedCalendarIds);
        }
      } catch (err) {
        console.error("Error loading calendars:", err);
        setError(`Error loading calendars: ${err.message}`);
      } finally {
        setLoadingCalendars(false);
      }
    };

    loadCalendars();
  }, [user, integrations.google]);

  const handleCalendarToggle = (calendarId) => {
    setSelectedCalendars((prev) => {
      if (prev.includes(calendarId)) {
        return prev.filter((id) => id !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  const handleSaveCalendars = async () => {
    setSavingCalendars(true);
    try {
      const response = await fetch("/api/google-calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarIds: selectedCalendars }),
      });

      if (!response.ok) throw new Error("Failed to save calendar selection");

      alert("Calendar preferences saved successfully!");
    } catch (err) {
      console.error("Error saving calendars:", err);
      alert("Failed to save calendar preferences");
    } finally {
      setSavingCalendars(false);
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

      {integrations.google && (
        <section className="settings-section">
          <h2>Google Calendar Settings</h2>
          <p className="settings-description">
            Select which calendars to display on your dashboard. If none are selected, your primary
            calendar will be shown.
          </p>

          {loadingCalendars ? (
            <p>Loading calendars...</p>
          ) : calendars.length > 0 ? (
            <>
              <div className="calendar-list">
                {calendars.map((calendar) => (
                  <label key={calendar.id} className="calendar-item">
                    <input
                      type="checkbox"
                      checked={selectedCalendars.includes(calendar.id)}
                      onChange={() => handleCalendarToggle(calendar.id)}
                      className="calendar-item__checkbox"
                    />
                    <span className="calendar-item__name">
                      {calendar.summary}
                      {calendar.primary && <span className="calendar-item__badge">Primary</span>}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveCalendars}
                disabled={savingCalendars}
                className="button button--primary"
              >
                {savingCalendars ? "Saving..." : "Save Calendar Selection"}
              </button>
            </>
          ) : (
            <p>No calendars found. Try reconnecting your Google account.</p>
          )}
        </section>
      )}

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
