import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineFallback() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    // Check initial state
    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-overlay">
      <div className="offline-card animate-fade-up">
        <div className="offline-icon-ring">
          <WifiOff size={32} />
        </div>
        <h2 className="offline-title">You're offline</h2>
        <p className="offline-desc">
          It looks like you've lost your internet connection. Some features may
          not be available until you're back online.
        </p>
        <button
          className="offline-retry-btn"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} />
          <span>Retry</span>
        </button>
      </div>
    </div>
  );
}
