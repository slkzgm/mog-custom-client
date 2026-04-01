import { lazy, Suspense, useEffect, useState } from "react";

import { GameplayPrototypePage } from "../pages/gameplay-prototype-page";

const ClientShellPage = lazy(() =>
  import("../pages/client-shell-page").then((module) => ({
    default: module.ClientShellPage,
  })),
);

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

  if (view === "workbench") {
    return (
      <Suspense
        fallback={
          <main className="gameplay-map-page gameplay-map-page-empty">
            <section className="gameplay-map-empty-card">
              <p className="panel-eyebrow">Workbench</p>
              <h1>Loading interface</h1>
              <p className="text-muted">Preparing the runtime tools and wallet session.</p>
            </section>
          </main>
        }
      >
        <ClientShellPage />
      </Suspense>
    );
  }

  return <GameplayPrototypePage />;
}
