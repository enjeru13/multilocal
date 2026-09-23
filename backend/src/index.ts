import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";
import { iniciarRespaldosAutomaticos } from "./lib/respaldos";

export { createApp };

export function startServer(port = Number(process.env.PORT) || 4000, host = "127.0.0.1") {
  const app = createApp();
  iniciarRespaldosAutomaticos();
  return app.listen(port, host, () =>
    console.log(`Server running at http://${host}:${port}`)
  );
}

// Permite seguir usando `pnpm dev:backend` de forma standalone.
if (require.main === module) {
  startServer();
}
