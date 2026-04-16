import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setTransitioning(true);

      // Short exit, then swap content and enter
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitioning(false);
      }, 150);

      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [location.pathname, children]);

  return (
    <div
      className={`page-transition ${transitioning ? "page-exit" : "page-enter"}`}
    >
      {displayChildren}
    </div>
  );
}
