import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./data/api";
import { worker } from "./data/mocks";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
root.render(
  <div className="boot" role="status">
    Opening the harbor…
  </div>,
);
void worker
  .start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  })
  .then(() =>
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    ),
  )
  .catch(() => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <div role="alert" className="offline-notice">
            The mock harbor service could not start. Gameplay remains available;
            registration may fail.
          </div>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
