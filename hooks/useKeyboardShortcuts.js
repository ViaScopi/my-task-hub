import { useEffect, useCallback } from "react";
import { useRouter } from "next/router";

export const KEYBOARD_SHORTCUTS = [
  { key: "g d", description: "Go to Dashboard", action: "/dashboard" },
  { key: "g t", description: "Go to Today", action: "/today" },
  { key: "g f", description: "Go to Focus Mode", action: "/focus" },
  { key: "g k", description: "Go to Kanban Board", action: "/kanban" },
  { key: "g c", description: "Go to Calendar", action: "/calendar" },
  { key: "g a", description: "Go to Archive", action: "/archived" },
  { key: "g s", description: "Go to Settings", action: "/settings" },
  { key: "?", description: "Show keyboard shortcuts", action: "help" },
  { key: "Escape", description: "Close modal / Exit", action: "escape" },
];

export function useKeyboardShortcuts({ onShowHelp, onEscape }) {
  const router = useRouter();

  const handleKeyPress = useCallback(
    (event) => {
      // Don't trigger shortcuts when typing in inputs or textareas
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.tagName === "SELECT" ||
        event.target.isContentEditable
      ) {
        // Allow Escape to blur/close even in inputs
        if (event.key === "Escape" && onEscape) {
          onEscape();
        }
        return;
      }

      // Help modal trigger
      if (event.key === "?" && event.shiftKey) {
        event.preventDefault();
        if (onShowHelp) {
          onShowHelp();
        }
        return;
      }

      // Escape key
      if (event.key === "Escape") {
        event.preventDefault();
        if (onEscape) {
          onEscape();
        }
        return;
      }
    },
    [onShowHelp, onEscape]
  );

  const handleSequence = useCallback(
    (sequence) => {
      const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.key === sequence);
      if (shortcut && shortcut.action.startsWith("/")) {
        router.push(shortcut.action);
      }
    },
    [router]
  );

  useEffect(() => {
    let keySequence = "";
    let sequenceTimeout;

    const handleKeyDown = (event) => {
      // Clear sequence after 1 second of inactivity
      clearTimeout(sequenceTimeout);

      // Handle immediate shortcuts first
      handleKeyPress(event);

      // Build key sequence for "g x" style shortcuts
      if (
        event.target.tagName !== "INPUT" &&
        event.target.tagName !== "TEXTAREA" &&
        event.target.tagName !== "SELECT" &&
        !event.target.isContentEditable
      ) {
        keySequence += event.key.toLowerCase();

        // Check if we have a matching sequence
        if (keySequence.length >= 2) {
          const sequence = keySequence.slice(-2);
          handleSequence(sequence);
          keySequence = "";
        }

        sequenceTimeout = setTimeout(() => {
          keySequence = "";
        }, 1000);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(sequenceTimeout);
    };
  }, [handleKeyPress, handleSequence]);
}
