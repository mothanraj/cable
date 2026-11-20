import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./context/AuthProvider";
import { IdleSessionProvider } from "./context/IdleSessionProvider";

import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <IdleSessionProvider>
          <App />
        </IdleSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);