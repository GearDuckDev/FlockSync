import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

test("deployment packaging includes portable setup files and excludes operator state", {
  skip: process.platform !== "win32" && "PowerShell packager validation runs on Windows",
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "flocksync-package-"));
  const script = join(root, "scripts", "package-remote-server-deploy.ps1");
  const required = [
    "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json",
    "Dockerfile.api", "Dockerfile.web", "docker-compose.yml", ".dockerignore",
    ".env.example", "DEPLOYMENT.md", "SERVER-OPERATIONS.md", "LICENSE",
    "apps/api/src/server.ts", "apps/api/.env.example",
    "apps/web/src/main.tsx", "packages/shared-types/src/index.ts", "deploy/update-server.sh",
  ];
  const privateFiles = [
    ".env", ".env.staging", "docker-compose.override.yml",
    "apps/api/.env", "apps/api/.env.development",
    "apps/api/local.db", "apps/api/local.db-wal", "apps/api/local.db-shm",
    "apps/api/local.sqlite", "apps/api/local.sqlite3-wal", "apps/api/server.log",
    "apps/api/data/backup.json", "apps/api/node_modules/private/index.js",
    "apps/api/dist/server.js", "apps/web/out/main.js",
    "deploy/host.local.md", "deploy/host.local/private.conf",
    "deploy/notes.local.md/private.txt", "deploy/SavedVariables/FlockSync.lua",
    "deploy/release/old.zip",
  ];
  try {
    await mkdir(dirname(script), { recursive: true });
    await copyFile(resolve("scripts/package-remote-server-deploy.ps1"), script);
    for (const relative of [...required, ...privateFiles]) {
      const path = join(root, relative);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "synthetic packaging fixture");
    }
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
      cwd: root, encoding: "utf8", timeout: 60_000,
    });
    const listing = execFileSync("powershell.exe", ["-NoProfile", "-Command",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
      "$zip=[IO.Compression.ZipFile]::OpenRead($env:FLOCKSYNC_TEST_ZIP); " +
      "try { ConvertTo-Json -InputObject @($zip.Entries | ForEach-Object { $_.FullName.Replace('\\','/') }) -Compress } " +
      "finally { $zip.Dispose() }",
    ], {
      env: { ...process.env, FLOCKSYNC_TEST_ZIP: join(root, "release", "FlockSync_Remote_Server_Deploy.zip") },
      encoding: "utf8", timeout: 30_000,
    });
    const entries = JSON.parse(listing).filter((path) => !path.endsWith("/"));
    assert.deepEqual(entries.sort(), required.map((path) => `FlockSync/${path}`).sort());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git ignores private environments and overrides, but keeps portable templates", () => {
  const privatePaths = [
    ".env", ".env.staging", "apps/api/.env.test",
    "docker-compose.override.yml", "compose.override.yaml", "host.local.md",
    "data/flocksync.db", "apps/api/backup.sqlite3-shm", "apps/api/server.log",
  ];
  const publicPaths = [".env.example", "apps/api/.env.example", "pnpm-lock.yaml",
    "deploy/test/resource-test.override.yml"];
  const result = execFileSync("git", ["check-ignore", "--no-index", "--stdin"], {
    input: [...privatePaths, ...publicPaths].join("\n") + "\n", encoding: "utf8",
  }).trim().split(/\r?\n/);
  assert.deepEqual(result.sort(), privatePaths.sort());
});
