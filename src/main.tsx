import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

const sentryDsn = import.meta.env['VITE_SENTRY_DSN'];
if (sentryDsn) void import('@sentry/react').then(({ init }) => init({ dsn: sentryDsn, environment: import.meta.env.MODE })).catch(() => undefined);

createRoot(document.getElementById("root")!).render(
    <AppWrapper>
      <App />
    </AppWrapper>
);
