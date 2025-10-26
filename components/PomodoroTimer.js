import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const DEFAULT_LONG_BREAK_MINUTES = 15;

export default function PomodoroTimer({ onSessionComplete }) {
  const [mode, setMode] = useState("work"); // 'work', 'break', 'longBreak'
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [longBreakMinutes, setLongBreakMinutes] = useState(DEFAULT_LONG_BREAK_MINUTES);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize audio element for notifications
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzWL0fPTgjMGHm7A7+OZRQ0PVKvo8qtcFgxKouLyvGMfBzqPz/PVgjIGHm++7+KXRQ0OVKrn8qldFQxKo+HxvGIgBzeNzvTWgTIGH2297+KYRA0PVKvo8KtcFgxLouLyvGIfBzeNzvTWgjEGIGy77+CZQw0PVKzn8qpdFgtLo+HyvGEfBzeNzvPWgjMGH2277+KYQw8OVKrn8qtcFgxLo+HyvWEfB");
  }, []);

  const getModeDuration = useCallback((currentMode) => {
    switch (currentMode) {
      case "work":
        return workMinutes * 60;
      case "break":
        return breakMinutes * 60;
      case "longBreak":
        return longBreakMinutes * 60;
      default:
        return workMinutes * 60;
    }
  }, [workMinutes, breakMinutes, longBreakMinutes]);

  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
    }
  }, [soundEnabled]);

  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setTimeLeft(getModeDuration(newMode));
    setIsRunning(false);
    playSound();

    // Show browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      const messages = {
        work: "Time to focus! 🎯",
        break: "Take a short break ☕",
        longBreak: "Enjoy your long break! 🌟",
      };
      new Notification("Pomodoro Timer", {
        body: messages[newMode],
        icon: "/favicon.ico",
      });
    }
  }, [getModeDuration, playSound]);

  const handleSessionComplete = useCallback(() => {
    const newSessionsCompleted = sessionsCompleted + 1;
    setSessionsCompleted(newSessionsCompleted);

    // After 4 work sessions, take a long break
    if (mode === "work") {
      if (onSessionComplete) {
        onSessionComplete();
      }

      if (newSessionsCompleted % 4 === 0) {
        switchMode("longBreak");
      } else {
        switchMode("break");
      }
    } else {
      switchMode("work");
    }
  }, [mode, sessionsCompleted, switchMode, onSessionComplete]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, handleSessionComplete]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(getModeDuration(mode));
  };

  const skipSession = () => {
    handleSessionComplete();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((getModeDuration(mode) - timeLeft) / getModeDuration(mode)) * 100;

  const modeLabels = {
    work: "Focus Time",
    break: "Short Break",
    longBreak: "Long Break",
  };

  const modeEmojis = {
    work: "🎯",
    break: "☕",
    longBreak: "🌟",
  };

  return (
    <div className="pomodoro">
      <div className="pomodoro__header">
        <h3 className="pomodoro__title">
          {modeEmojis[mode]} {modeLabels[mode]}
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="pomodoro__settings-btn"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="pomodoro__settings">
          <div className="pomodoro__setting">
            <label>Work Duration (minutes):</label>
            <input
              type="number"
              min="1"
              max="60"
              value={workMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setWorkMinutes(val);
                if (mode === "work" && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
            />
          </div>
          <div className="pomodoro__setting">
            <label>Break Duration (minutes):</label>
            <input
              type="number"
              min="1"
              max="30"
              value={breakMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setBreakMinutes(val);
                if (mode === "break" && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
            />
          </div>
          <div className="pomodoro__setting">
            <label>Long Break Duration (minutes):</label>
            <input
              type="number"
              min="1"
              max="60"
              value={longBreakMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setLongBreakMinutes(val);
                if (mode === "longBreak" && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
            />
          </div>
          <div className="pomodoro__setting pomodoro__setting--checkbox">
            <label>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <span>Sound notifications</span>
            </label>
          </div>
        </div>
      )}

      <div className="pomodoro__timer">
        <div className="pomodoro__display">{formatTime(timeLeft)}</div>
        <div className="pomodoro__progress">
          <div className="pomodoro__progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="pomodoro__controls">
        <button onClick={toggleTimer} className="button button--primary button--large">
          {isRunning ? "⏸ Pause" : "▶ Start"}
        </button>
        <button onClick={resetTimer} className="button button--ghost">
          🔄 Reset
        </button>
        <button onClick={skipSession} className="button button--ghost">
          ⏭ Skip
        </button>
      </div>

      <div className="pomodoro__stats">
        <div className="pomodoro__stat">
          <div className="pomodoro__stat-value">{sessionsCompleted}</div>
          <div className="pomodoro__stat-label">Sessions Completed</div>
        </div>
        <div className="pomodoro__stat">
          <div className="pomodoro__stat-value">{Math.floor(sessionsCompleted / 4)}</div>
          <div className="pomodoro__stat-label">Cycles Complete</div>
        </div>
      </div>
    </div>
  );
}
