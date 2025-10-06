import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const CHANNEL_FILTERS = [
  { id: "all", label: "All" },
  { id: "WhatsApp", label: "WhatsApp" },
  { id: "Email", label: "Email" },
  { id: "Google Docs/Sheets", label: "Docs & Sheets" },
];

const COMMUNICATION_ITEMS = [
  {
    id: "whatsapp-1",
    channel: "WhatsApp",
    contact: "Product Squad",
    topic: "Sprint demo follow-up",
    summary:
      "Share quick notes from yesterday's walkthrough and capture any final feedback before Monday's backlog grooming.",
    due: new Date().setHours(17, 0, 0, 0),
    importance: "High",
    attachments: ["Demo recording", "Backlog outline"],
  },
  {
    id: "email-1",
    channel: "Email",
    contact: "Finance @ Northwind",
    topic: "Q4 budget adjustments",
    summary: "Send the updated cost scenario and confirm the revised approval timeline.",
    due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    importance: "Medium",
    attachments: ["Scenario spreadsheet"],
  },
  {
    id: "docs-1",
    channel: "Google Docs/Sheets",
    contact: "Partnership Notes",
    topic: "Outline for client progress report",
    summary: "Review the shared document and add highlights from the latest client check-in.",
    due: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    importance: "Low",
    attachments: ["Client progress doc"],
  },
  {
    id: "whatsapp-2",
    channel: "WhatsApp",
    contact: "Ops Standup",
    topic: "Confirm launch readiness",
    summary:
      "Send a quick green/yellow/red status and flag any blockers ahead of tomorrow's deployment window.",
    due: new Date(Date.now() + 12 * 60 * 60 * 1000),
    importance: "High",
    attachments: [],
  },
];

const MESSAGE_MODES = [
  {
    id: "professional",
    label: "Professional",
    description: "Polished and considerate, ideal for formal updates.",
  },
  { id: "friendly", label: "Friendly", description: "Warm and upbeat with collaborative energy." },
  { id: "direct", label: "Direct", description: "Straight to the point when speed matters." },
  { id: "brief", label: "Brief", description: "A concise summary when the ask is clear." },
];

const REPLY_THREADS = [
  {
    id: "inbox-1",
    channel: "Email",
    subject: "Re: Q4 forecasting cadence",
    from: "Ada from Finance",
    receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    excerpt: "Can you clarify which version of the revenue model we should review in tomorrow's sync?",
    context:
      "They're waiting on confirmation that the November updates are the latest numbers before they circulate.",
    suggestions: [
      {
        id: "short",
        label: "Short",
        body:
          "Thanks for flagging this. Please review the November 12th version titled 'Revenue Forecast - Rev D'. Let me know if anything is unclear before tomorrow's sync.",
      },
      {
        id: "medium",
        label: "Medium",
        body:
          "Thanks for checking. The version to review is the November 12 file named 'Revenue Forecast - Rev D'. It has the scenario tweaks we discussed with leadership. Happy to walk through any section ahead of the meeting.",
      },
      {
        id: "formal",
        label: "Formal",
        body:
          "Appreciate the follow-up. Please work from the November 12 iteration labeled 'Revenue Forecast - Rev D'. It consolidates all approved changes. Do reach out if further clarification would be helpful before tomorrow's session.",
      },
    ],
    autoDraft:
      "Hello Ada,\n\nThe November 12 'Revenue Forecast - Rev D' workbook is the latest version and includes the cost realignments we approved yesterday. If you'd like, I can highlight the assumptions during tomorrow's sync.\n\nBest,",
  },
  {
    id: "inbox-2",
    channel: "WhatsApp",
    subject: "New vendor onboarding",
    from: "Jordan (Ops)",
    receivedAt: new Date(Date.now() - 75 * 60 * 1000),
    excerpt: "Hey! Legal signed the security review. Do you want me to introduce them to Support this afternoon?",
    context:
      "Need to acknowledge the update and share the next two steps so the hand-off stays on track.",
    suggestions: [
      {
        id: "quick",
        label: "Quick",
        body:
          "Amazing, thanks for the update! Yes, please connect them with Support and loop me in so I can share the onboarding checklist tomorrow morning.",
      },
      {
        id: "detailed",
        label: "Detailed",
        body:
          "This is great news. Please introduce the vendor to the Support lead this afternoon and CC me. I'll follow up tomorrow with the onboarding checklist and confirm the first reporting touchpoint.",
      },
      {
        id: "formal",
        label: "Formal",
        body:
          "Thank you for confirming. An introduction to the Support lead today would be perfect. Kindly copy me on the chat and I'll distribute the onboarding checklist first thing tomorrow.",
      },
    ],
    autoDraft:
      "Hi Jordan,\n\nFantastic news on the security review. Go ahead and connect them with Support today and include me on the thread. I'll send the onboarding checklist tomorrow so we can lock in the first progress checkpoint.\n\nThanks,",
  },
  {
    id: "inbox-3",
    channel: "Email",
    subject: "Client success metrics",
    from: "Priya (CS)",
    receivedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    excerpt: "Could you share a quick blurb summarizing what we delivered for Lumen this week?",
    context:
      "Provide a positive recap with a forward-looking next step for the client digest.",
    suggestions: [
      {
        id: "short",
        label: "Short",
        body:
          "We wrapped the analytics handoff for Lumen and confirmed the adoption playbook with their ops lead. Next up is enabling dashboards for their regional pods on Tuesday.",
      },
      {
        id: "warm",
        label: "Warm",
        body:
          "Highlights this week: the analytics package is live for Lumen, adoption metrics are trending up, and their ops lead signed off on the enablement path. We're now prepping the regional dashboards for Tuesday's review.",
      },
      {
        id: "formal",
        label: "Formal",
        body:
          "Key wins for Lumen: analytics toolkit delivered, adoption targets met for week two, and the enablement plan confirmed with their operations lead. We'll brief their regional teams once dashboards go live on Tuesday.",
      },
    ],
    autoDraft:
      "Hi Priya,\n\nLumen received the analytics toolkit, we've hit the adoption goals for week two, and their operations lead approved the enablement cadence. We're on track to brief regional pods when dashboards ship Tuesday.\n\nBest,",
  },
];

const SUMMARY_BLUEPRINTS = [
  {
    id: "weekly-update",
    label: "Weekly Update",
    description: "Snapshot of wins, blockers, and next priorities.",
    sections: [
      {
        title: "Highlights",
        items: [
          "Shipped analytics toolkit to Lumen with positive feedback.",
          "Closed security review for the new vendor and kicked off onboarding.",
          "Resolved backlog of GitHub issues tied to reporting dashboards.",
        ],
      },
      {
        title: "In Motion",
        items: [
          "Preparing stakeholder summary deck for Monday's steering sync.",
          "Coordinating roll-out schedule with Support and CS teams.",
        ],
      },
      {
        title: "Next Focus",
        items: ["Finalize QA checklist for Tuesday release.", "Draft outreach for Q4 client renewals."],
      },
    ],
  },
  {
    id: "client-progress",
    label: "Client Progress Report",
    description: "Share structured progress tailored to clients.",
    sections: [
      {
        title: "Delivery",
        items: [
          "Analytics toolkit configured and knowledge transfer scheduled.",
          "Weekly office hours booked through December.",
        ],
      },
      {
        title: "Impact",
        items: [
          "Adoption rate climbed 14% week-over-week.",
          "First success story drafted for the December newsletter.",
        ],
      },
      {
        title: "Upcoming",
        items: [
          "Regional dashboards go live Tuesday with support guides.",
          "Quarterly business review outline arriving Friday.",
        ],
      },
    ],
  },
  {
    id: "personal-accomplishments",
    label: "What I've Done This Week",
    description: "Personal reflection to drop into standups or 1:1s.",
    sections: [
      {
        title: "Shipped",
        items: [
          "Closed 12 backlog tickets and documented takeaways in Confluence.",
          "Simplified the onboarding workflow with automated checklists.",
        ],
      },
      {
        title: "Collaborated",
        items: [
          "Hosted cross-functional sync with Ops and Support on vendor rollout.",
          "Paired with Design to refresh status dashboards.",
        ],
      },
      {
        title: "Looking Ahead",
        items: ["Refine success metrics with CS", "Draft OKR updates for leadership"],
      },
    ],
  },
];

const ROUTINE_PROMPTS = [
  {
    id: "client-check-in",
    title: "Client check-in",
    cadence: "Fridays at 10:00 AM",
    schedule: { weekday: 5, hour: 10, minute: 0 },
    template:
      "Hi <client>, just checking in to see how everything is landing this week. Let me know if anything new popped up or if you'd like to walk through the latest metrics together.",
  },
  {
    id: "stakeholder-update",
    title: "Executive stakeholder update",
    cadence: "Tuesdays at 4:30 PM",
    schedule: { weekday: 2, hour: 16, minute: 30 },
    template:
      "Hello <name>, quick touchpoint to surface progress, upcoming decisions, and any support we need from your side before the steering sync.",
  },
  {
    id: "team-gratitude",
    title: "Team gratitude note",
    cadence: "Wednesdays at 9:00 AM",
    schedule: { weekday: 3, hour: 9, minute: 0 },
    template:
      "Hey team, sharing a quick win and a thank-you for the collaboration this week. Feel free to add your shout-outs!",
  },
];

function formatDueDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return formatter.format(date);
}

function getDueBadge(value) {
  if (!value) {
    return { label: "", tone: "" };
  }

  const now = new Date();
  const due = new Date(value);

  if (Number.isNaN(due.getTime())) {
    return { label: "", tone: "" };
  }

  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < -1) {
    return { label: "Overdue", tone: "danger" };
  }

  if (diffHours <= 12) {
    return { label: "Due soon", tone: "warning" };
  }

  if (diffHours <= 48) {
    return { label: "Upcoming", tone: "info" };
  }

  return { label: "Scheduled", tone: "neutral" };
}

function normalizeSentences(value) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => {
      const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    })
    .join(" ");
}

function rewriteMessage(draft, modeId, signature) {
  const trimmed = draft.trim();

  if (!trimmed) {
    return "";
  }

  const messageBody = normalizeSentences(trimmed);
  const author = signature || "Your Name";
  const CONFIG = {
    professional: {
      greeting: "Hello team,",
      preface: "I hope you're doing well.",
      closing: "Best regards",
    },
    friendly: {
      greeting: "Hey there!",
      preface: "Quick note from me:",
      closing: "Cheers",
    },
    direct: {
      greeting: "Hi all,",
      preface: "Sharing the essentials:",
      closing: "Thanks",
    },
    brief: {
      greeting: "Hi,",
      preface: "",
      closing: "-",
    },
  };

  const tone = CONFIG[modeId] || CONFIG.professional;
  const segments = [tone.greeting];

  if (tone.preface) {
    segments.push("", tone.preface);
  }

  segments.push("", messageBody);
  segments.push("", `${tone.closing}${tone.closing === "-" ? "" : ","}`);
  segments.push(author);

  return segments.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildSummaryDraft(option, signature) {
  if (!option) {
    return "";
  }

  const lines = [option.label];

  option.sections.forEach((section) => {
    lines.push("", `${section.title}:`);
    section.items.forEach((item) => {
      lines.push(`• ${item}`);
    });
  });

  if (signature) {
    lines.push("", `Prepared by ${signature}`);
  }

  return lines.join("\n");
}

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getNextOccurrence({ weekday, hour, minute }) {
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);

  let diff = weekday - result.getDay();
  if (diff < 0) {
    diff += 7;
  }

  if (diff === 0 && result <= now) {
    diff = 7;
  }

  result.setDate(result.getDate() + diff);

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return formatter.format(result);
}

export default function CommunicationsDashboardPage() {
  const { user } = useUser();
  const [activeChannel, setActiveChannel] = useState(CHANNEL_FILTERS[0].id);
  const [draft, setDraft] = useState("");
  const [composerMode, setComposerMode] = useState(MESSAGE_MODES[0].id);
  const [composerNotice, setComposerNotice] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(REPLY_THREADS[0]?.id ?? null);
  const [selectedSummaryId, setSelectedSummaryId] = useState(SUMMARY_BLUEPRINTS[0]?.id ?? null);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportNotice, setExportNotice] = useState("");

  useEffect(() => {
    if (!composerNotice) {
      return undefined;
    }

    const timer = setTimeout(() => setComposerNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [composerNotice]);

  useEffect(() => {
    if (!exportNotice) {
      return undefined;
    }

    const timer = setTimeout(() => setExportNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [exportNotice]);

  const displayName = useMemo(() => {
    if (!user) {
      return "Your name";
    }

    return (
      user.fullName ||
      user.firstName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Your name"
    );
  }, [user]);

  const filteredCommunications = useMemo(() => {
    if (activeChannel === "all") {
      return COMMUNICATION_ITEMS;
    }

    return COMMUNICATION_ITEMS.filter((item) => item.channel === activeChannel);
  }, [activeChannel]);

  const polishedMessage = useMemo(
    () => rewriteMessage(draft, composerMode, displayName),
    [draft, composerMode, displayName]
  );

  const activeThread = useMemo(
    () => REPLY_THREADS.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId]
  );

  const summaryOption = useMemo(
    () => SUMMARY_BLUEPRINTS.find((option) => option.id === selectedSummaryId) ?? null,
    [selectedSummaryId]
  );

  const summaryDraft = useMemo(
    () => buildSummaryDraft(summaryOption, displayName),
    [summaryOption, displayName]
  );

  const routinePlans = useMemo(
    () =>
      ROUTINE_PROMPTS.map((prompt) => ({
        ...prompt,
        nextOccurrence: getNextOccurrence(prompt.schedule),
      })),
    []
  );

  const handleApplySuggestion = (text, sourceLabel) => {
    setDraft(text);
    setComposerNotice(`Loaded suggestion from ${sourceLabel}.`);
  };

  const handleExport = () => {
    if (!summaryOption) {
      return;
    }

    setExportNotice(`Prepared ${summaryOption.label} as ${exportFormat.toUpperCase()}.`);
  };

  return (
    <>
      <SignedOut>
        <main className="restricted">
          <div className="restricted__card">
            <h1>Sign in to open the communications hub</h1>
            <p>
              This space keeps your WhatsApp, email, and document conversations organized in one view. Please
              <Link href="/login"> log in</Link> to continue.
            </p>
          </div>
        </main>
      </SignedOut>
      <SignedIn>
        <main className="comms-dashboard">
          <section className="comms-dashboard__intro">
            <h1>Communications command center</h1>
            <p>
              Plan outreach, polish replies, and generate updates without leaving My Task Hub. Everything here stays
              aligned with your tone and cadence.
            </p>
          </section>

          <section className="comms-card" aria-labelledby="unified-communications-heading">
            <header className="comms-card__header">
              <div>
                <h2 id="unified-communications-heading">Unified communication dashboard</h2>
                <p>Review every conversation that needs a touchpoint and triage by urgency.</p>
              </div>
              <div className="comms-card__filters" role="group" aria-label="Filter by channel">
                {CHANNEL_FILTERS.map((filter) => {
                  const isActive = activeChannel === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveChannel(filter.id)}
                      className={`chip${isActive ? " chip--active" : ""}`}
                      aria-pressed={isActive}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </header>

            <ul className="comms-list">
              {filteredCommunications.map((item) => {
                const badge = getDueBadge(item.due);

                return (
                  <li key={item.id} className="comms-list__item">
                    <div className="comms-list__meta">
                      <span
                        className={`comms-list__channel comms-list__channel--${item.channel
                          .replace(/[\\s/]+/g, "-")
                          .toLowerCase()}`}
                      >
                        {item.channel}
                      </span>
                      {badge.label ? (
                        <span className={`comms-list__badge comms-list__badge--${badge.tone}`}>{badge.label}</span>
                      ) : null}
                      <span className={`comms-list__badge comms-list__badge--importance-${item.importance.toLowerCase()}`}>
                        {item.importance} priority
                      </span>
                    </div>
                    <div className="comms-list__content">
                      <div className="comms-list__header">
                        <h3>{item.topic}</h3>
                        <span className="comms-list__due">Due {formatDueDate(item.due)}</span>
                      </div>
                      <p className="comms-list__summary">{item.summary}</p>
                      <p className="comms-list__contact">To: {item.contact}</p>
                      {item.attachments.length > 0 ? (
                        <ul className="comms-list__attachments">
                          {item.attachments.map((attachment) => (
                            <li key={attachment}>{attachment}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="comms-card" aria-labelledby="composer-heading">
            <header className="comms-card__header">
              <div>
                <h2 id="composer-heading">AI message composer</h2>
                <p>Write in your natural voice—the assistant polishes it to match the tone you need.</p>
              </div>
            </header>
            <div className="composer">
              <div className="composer__controls" role="group" aria-label="Select tone">
                {MESSAGE_MODES.map((mode) => {
                  const isActive = composerMode === mode.id;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      className={`chip${isActive ? " chip--active" : ""}`}
                      onClick={() => setComposerMode(mode.id)}
                      aria-pressed={isActive}
                    >
                      <span className="chip__label">{mode.label}</span>
                      <span className="chip__description">{mode.description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="composer__inputs">
                <label htmlFor="composer-draft" className="composer__label">
                  Your rough draft
                </label>
                <textarea
                  id="composer-draft"
                  className="composer__textarea"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Drop in fragments, bullet points, or a quick brain dump."
                />
              </div>
              <div className="composer__outputs">
                <div className="composer__label">Suggested message</div>
                <pre className="composer__preview" aria-live="polite">
{polishedMessage || "Compose a draft to see the polished version."}
                </pre>
                {composerNotice ? <div className="composer__notice">{composerNotice}</div> : null}
              </div>
            </div>
          </section>

          <section className="comms-card" aria-labelledby="reply-assistant-heading">
            <header className="comms-card__header">
              <div>
                <h2 id="reply-assistant-heading">Automated reply assistant</h2>
                <p>Skim incoming requests and send the right response with one click.</p>
              </div>
            </header>
            <div className="reply-assistant">
              <aside className="reply-assistant__inbox" aria-label="Inbox threads">
                <ul>
                  {REPLY_THREADS.map((thread) => {
                    const isActive = thread.id === selectedThreadId;

                    return (
                      <li key={thread.id}>
                        <button
                          type="button"
                          className={`reply-assistant__thread${isActive ? " reply-assistant__thread--active" : ""}`}
                          onClick={() => setSelectedThreadId(thread.id)}
                          aria-pressed={isActive}
                        >
                          <span className="reply-assistant__thread-subject">{thread.subject}</span>
                          <span className="reply-assistant__thread-meta">
                            {thread.from} • {thread.channel}
                          </span>
                          <span className="reply-assistant__thread-time">{formatRelativeTime(thread.receivedAt)}</span>
                          <span className="reply-assistant__thread-excerpt">{thread.excerpt}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
              <div className="reply-assistant__detail">
                {activeThread ? (
                  <>
                    <header className="reply-assistant__detail-header">
                      <h3>{activeThread.subject}</h3>
                      <p>{activeThread.context}</p>
                    </header>
                    <div className="reply-assistant__suggestions" role="list">
                      {activeThread.suggestions.map((suggestion) => (
                        <article key={suggestion.id} className="reply-assistant__suggestion" role="listitem">
                          <header>
                            <h4>{suggestion.label} response</h4>
                          </header>
                          <p>{suggestion.body}</p>
                          <button
                            type="button"
                            className="button button--primary reply-assistant__button"
                            onClick={() => handleApplySuggestion(suggestion.body, activeThread.subject)}
                          >
                            Send to composer
                          </button>
                        </article>
                      ))}
                    </div>
                    <div className="reply-assistant__autodraft">
                      <h4>Auto-drafted reply</h4>
                      <pre>{`${activeThread.autoDraft} ${displayName}`}</pre>
                      <button
                        type="button"
                        className="button button--ghost reply-assistant__button"
                        onClick={() => handleApplySuggestion(`${activeThread.autoDraft} ${displayName}`, activeThread.subject)}
                      >
                        Use auto-draft
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Select a conversation to view suggestions.</p>
                )}
              </div>
            </div>
          </section>

          <section className="comms-card" aria-labelledby="summary-builder-heading">
            <header className="comms-card__header">
              <div>
                <h2 id="summary-builder-heading">Report &amp; summary builder</h2>
                <p>Assemble updates from WhatsApp, email, notes, and tasks into a ready-to-share brief.</p>
              </div>
            </header>
            <div className="summary-builder">
              <div className="summary-builder__controls">
                <label htmlFor="summary-template" className="summary-builder__label">
                  Summary template
                </label>
                <select
                  id="summary-template"
                  value={selectedSummaryId ?? ""}
                  onChange={(event) => setSelectedSummaryId(event.target.value)}
                >
                  {SUMMARY_BLUEPRINTS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {summaryOption ? <p className="summary-builder__description">{summaryOption.description}</p> : null}
              </div>
              <div className="summary-builder__preview">
                {summaryOption ? (
                  <>
                    <div className="summary-builder__sections">
                      {summaryOption.sections.map((section) => (
                        <section key={section.title}>
                          <h3>{section.title}</h3>
                          <ul>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                    <div className="summary-builder__draft">
                      <h4>Ready-to-export draft</h4>
                      <pre>{summaryDraft}</pre>
                    </div>
                  </>
                ) : (
                  <p>Select a summary type to preview the content.</p>
                )}
              </div>
              <div className="summary-builder__export">
                <label htmlFor="summary-export" className="summary-builder__label">
                  Export format
                </label>
                <select
                  id="summary-export"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value)}
                >
                  <option value="docx">Word (.docx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="email">Email template</option>
                </select>
                <button type="button" className="button button--primary" onClick={handleExport}>
                  Prepare export
                </button>
                {exportNotice ? <div className="summary-builder__notice">{exportNotice}</div> : null}
              </div>
            </div>
          </section>

          <section className="comms-card" aria-labelledby="routine-helper-heading">
            <header className="comms-card__header">
              <div>
                <h2 id="routine-helper-heading">Routine helper</h2>
                <p>Stay ahead of recurring check-ins using your own tone templates.</p>
              </div>
            </header>
            <ul className="routine-list">
              {routinePlans.map((routine) => (
                <li key={routine.id} className="routine-list__item">
                  <div className="routine-list__header">
                    <h3>{routine.title}</h3>
                    <span className="routine-list__cadence">{routine.cadence}</span>
                    <span className="routine-list__next">Next nudged: {routine.nextOccurrence}</span>
                  </div>
                  <p className="routine-list__template">{routine.template}</p>
                  <button
                    type="button"
                    className="button button--ghost routine-list__button"
                    onClick={() => handleApplySuggestion(routine.template, routine.title)}
                  >
                    Load into composer
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </SignedIn>
    </>
  );
}
