import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Don't show if dismissed recently (24h cooldown)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 86400000) return;

    // Detect iOS (no beforeinstallprompt support)
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Show iOS-specific banner after a short delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome/Edge/Android: listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="pwa-install-banner animate-fade-up">
      <div className="pwa-install-banner-inner">
        <div className="pwa-install-icon">
          <Download size={20} />
        </div>
        <div className="pwa-install-text">
          <strong>Install GridArena</strong>
          {isIos ? (
            <span>
              Tap <span className="pwa-install-highlight">Share</span> then{" "}
              <span className="pwa-install-highlight">Add to Home Screen</span>
            </span>
          ) : (
            <span>Add to your home screen for quick access</span>
          )}
        </div>
        <div className="pwa-install-actions">
          {!isIos && (
            <button className="pwa-install-btn" onClick={handleInstall}>
              Install
            </button>
          )}
          <button
            className="pwa-install-close"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
