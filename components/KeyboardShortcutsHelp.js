import { KEYBOARD_SHORTCUTS } from "../hooks/useKeyboardShortcuts";

export default function KeyboardShortcutsHelp({ onClose }) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="keyboard-help" onClick={handleBackdropClick}>
      <div className="keyboard-help__modal">
        <div className="keyboard-help__header">
          <h2 className="keyboard-help__title">⌨️ Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="keyboard-help__close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="keyboard-help__content">
          <p className="keyboard-help__description">
            Navigate faster and stay in your flow with keyboard shortcuts. Press{" "}
            <kbd>?</kbd> anytime to see this help.
          </p>

          <div className="keyboard-help__section">
            <h3 className="keyboard-help__section-title">Navigation</h3>
            <div className="keyboard-help__shortcuts">
              {KEYBOARD_SHORTCUTS.filter((s) => s.key.startsWith("g")).map(
                (shortcut) => (
                  <div key={shortcut.key} className="keyboard-help__shortcut">
                    <div className="keyboard-help__keys">
                      {shortcut.key.split(" ").map((key, index) => (
                        <kbd key={index} className="keyboard-help__key">
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <div className="keyboard-help__shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="keyboard-help__section">
            <h3 className="keyboard-help__section-title">General</h3>
            <div className="keyboard-help__shortcuts">
              {KEYBOARD_SHORTCUTS.filter((s) => !s.key.startsWith("g")).map(
                (shortcut) => (
                  <div key={shortcut.key} className="keyboard-help__shortcut">
                    <div className="keyboard-help__keys">
                      <kbd className="keyboard-help__key">{shortcut.key}</kbd>
                    </div>
                    <div className="keyboard-help__shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="keyboard-help__tip">
            <strong>💡 Pro tip:</strong> Sequential shortcuts like{" "}
            <kbd>g</kbd> <kbd>t</kbd> work by pressing the keys in order within
            1 second.
          </div>
        </div>
      </div>
    </div>
  );
}
