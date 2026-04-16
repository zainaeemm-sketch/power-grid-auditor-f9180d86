import { useState, useEffect } from "react";

export function PwaSplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (!isStandalone) {
      setVisible(false);
      return;
    }

    const fadeTimer = setTimeout(() => setFadeOut(true), 1800);
    const hideTimer = setTimeout(() => setVisible(false), 2400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`splash-screen ${fadeOut ? "splash-fade-out" : ""}`}
      aria-hidden="true"
    >
      <div className="splash-content">
        {/* Animated logo */}
        <div className="splash-logo">
          <div className="splash-ring" />
          <span className="splash-initials">GA</span>
        </div>

        {/* App name */}
        <h1 className="splash-title">GridArena</h1>
        <p className="splash-subtitle">LLM Agent Research Platform</p>

        {/* Loading bar */}
        <div className="splash-loader">
          <div className="splash-loader-bar" />
        </div>
      </div>
    </div>
  );
}
