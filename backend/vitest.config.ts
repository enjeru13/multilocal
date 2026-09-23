import { defineConfig } from "vitest/config";
import os from "os";
import path from "path";

// Cada corrida usa una base SQLite temporal propia, nunca la de desarrollo.
const dir = path.join(os.tmpdir(), `mostrador-test-db-${process.pid}`);
const dbFile = path.join(dir, "test.db").split(path.sep).join("/");

// globalSetup corre en el proceso principal: necesita las variables ya definidas.
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.TEST_DB_DIR = dir;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["./tests/globalSetup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "secreto-solo-para-tests",
      DATABASE_URL: `file:${dbFile}`,
      BACKUP_DIR: path.join(dir, "respaldos"),
      TEST_DB_DIR: dir,
    },
  },
});
