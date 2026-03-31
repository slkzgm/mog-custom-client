import { useEffect, useState } from "react";

import { ClientShellPage } from "../pages/client-shell-page";
import { GameplayPrototypePage } from "../pages/gameplay-prototype-page";

function getCurrentView(): "gameplay" | "workbench" {
  return window.location.hash === "#workbench" ? "workbench" : "gameplay";
}

export function App() {
  const [view, setView] = useState<"gameplay" | "workbench">(() => getCurrentView());

  useEffect(() => {
    function onHashChange() {
      setView(getCurrentView());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return (
    <>
      <nav className="app-view-switch">
        <a href="#" className={view === "gameplay" ? "app-view-switch-link is-active" : "app-view-switch-link"}>
          Gameplay
        </a>
        <a
          href="#workbench"
          className={view === "workbench" ? "app-view-switch-link is-active" : "app-view-switch-link"}
        >
          Workbench
        </a>
      </nav>
      {view === "workbench" ? <ClientShellPage /> : <GameplayPrototypePage />}
    </>
  );
}
