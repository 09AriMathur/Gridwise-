import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { seedDemoOnFirstRun } from "./lib/demo";
import "./index.css";

// Fill a fresh browser with src/data/demo-data.json before the first render.
seedDemoOnFirstRun();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
