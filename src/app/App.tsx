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

  return view === "workbench" ? <ClientShellPage /> : <GameplayPrototypePage />;
}
