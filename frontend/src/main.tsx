import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { TemaProvider } from "./tema/TemaProvider";
import "./pwa/instalar";
import { registrarServiceWorker } from "./pwa/registrar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TemaProvider>
      <App />
    </TemaProvider>
  </StrictMode>
);

registrarServiceWorker();
