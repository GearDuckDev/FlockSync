import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const image = "flocksync-backup:update-tests";
const root = resolve(import.meta.dirname, "..", "..");
const docker = (args) => spawnSync("docker", args, { encoding: "utf8", timeout: 120_000 });
const fixtures = (run) => {
  const directory = mkdtempSync(join(tmpdir(), "flocksync-update-tests-"));
  try { run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
};
const succeeded = (result) => assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
const runBackup = (directory, reason, readOnly = false) => docker([
  "run", "--rm", "--mount", `type=bind,source=${join(directory, "data")},target=/data,readonly`,
  "--mount", `type=bind,source=${join(directory, "backups")},target=/backups${readOnly ? ",readonly" : ""}`,
  "-e", "BACKUP_ONCE=1", "-e", `BACKUP_REASON=${reason}`, image
]);

test("verified pre-update backups are unique and not removed by daily retention", () => fixtures((directory) => {
  mkdirSync(join(directory, "data"));
  mkdirSync(join(directory, "backups"));
  succeeded(docker(["run", "--rm", "--mount", `type=bind,source=${join(directory, "data")},target=/data`,
    "--entrypoint", "sqlite3", image, "/data/flocksync.db",
    "CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('preserved');"]));
  succeeded(runBackup(directory, "pre-update"));
  succeeded(runBackup(directory, "pre-update"));
  const files = readdirSync(join(directory, "backups")).filter((name) => name.endsWith(".db"));
  assert.equal(files.length, 2);
  assert.ok(files.every((name) => name.startsWith("flocksync-pre-update-")));
  const old = new Date(Date.now() - 40 * 86400_000);
  for (const name of files) utimesSync(join(directory, "backups", name), old, old);
  const daily = join(directory, "backups", "flocksync-20000101.db");
  writeFileSync(daily, "old daily backup");
  utimesSync(daily, old, old);
  succeeded(runBackup(directory, "daily"));
  const retained = readdirSync(join(directory, "backups"));
  assert.ok(files.every((name) => retained.includes(name)));
  assert.ok(!retained.includes("flocksync-20000101.db"));
  const read = docker(["run", "--rm", "--mount", `type=bind,source=${join(directory, "backups")},target=/backups,readonly`,
    "--entrypoint", "sqlite3", image, `/backups/${files[0]}`, "SELECT value FROM sample;"]);
  succeeded(read);
  assert.match(read.stdout, /preserved/);
  assert.notEqual(runBackup(directory, "pre-update", true).status, 0, "Unwritable destination must fail");
}));

test("missing or corrupt databases fail without publishing a success-shaped backup", () => fixtures((directory) => {
  mkdirSync(join(directory, "data"));
  mkdirSync(join(directory, "backups"));
  assert.notEqual(runBackup(directory, "pre-update").status, 0);
  writeFileSync(join(directory, "data", "flocksync.db"), "not a SQLite database");
  assert.notEqual(runBackup(directory, "pre-update").status, 0);
  assert.deepEqual(readdirSync(join(directory, "backups")), []);
}));

test("online backup includes live WAL writes while the API-style connection stays open", () => fixtures((directory) => {
  mkdirSync(join(directory, "data"));
  mkdirSync(join(directory, "backups"));
  const writer = docker(["run", "--rm", "-d", "--mount", `type=bind,source=${join(directory, "data")},target=/data`,
    "--entrypoint", "/bin/sh", image, "-c",
    "{ printf \"PRAGMA journal_mode=WAL; CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('live WAL'); SELECT 'ready';\\n\"; sleep 60; } | sqlite3 /data/flocksync.db"]);
  succeeded(writer);
  const id = writer.stdout.trim();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (docker(["logs", id]).stdout.includes("ready")) { ready = true; break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    assert.ok(ready, "WAL writer must be ready");
    succeeded(runBackup(directory, "pre-update"));
    const file = readdirSync(join(directory, "backups")).find((name) => name.endsWith(".db"));
    const result = docker(["run", "--rm", "--mount", `type=bind,source=${join(directory, "backups")},target=/backups`,
      "--entrypoint", "sqlite3", image, `/backups/${file}`, "SELECT value FROM sample;"]);
    succeeded(result);
    assert.match(result.stdout, /live WAL/);
  } finally {
    docker(["stop", "-t", "1", id]);
  }
}));

test("update command gates rebuild/restart on backup success and uses the production environment", () => fixtures((directory) => {
  mkdirSync(join(directory, "bin"));
  writeFileSync(join(directory, ".env.production"), "NAS_BACKUP_PATH=/chosen/backup\n");
  writeFileSync(join(directory, "docker-compose.yml"), "services: {}\n");
  writeFileSync(join(directory, "update-server.sh"), readFileSync(join(root, "deploy", "update-server.sh")));
  writeFileSync(join(directory, "bin", "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> /work/commands.log
case "$*" in
  *"config --quiet"*) exit "\${FAIL_CONFIG:-0}" ;;
  *"build db-backup"*) exit "\${FAIL_TOOLING:-0}" ;;
  *"run --rm --no-deps -e BACKUP_ONCE=1 -e BACKUP_REASON=pre-update db-backup"*) exit "\${FAIL_BACKUP:-0}" ;;
  *"build api web"*) exit "\${FAIL_BUILD:-0}" ;;
esac
exit 0
`);
  const run = (env) => {
    writeFileSync(join(directory, "commands.log"), "");
    return docker(["run", "--rm", "--mount", `type=bind,source=${directory},target=/work`, "-w", "/work",
      ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      "--entrypoint", "/bin/sh", image, "-c",
      "chmod +x /work/bin/docker; export PATH=/work/bin:$PATH; sh /work/update-server.sh"]);
  };
  succeeded(run({}));
  const log = readFileSync(join(directory, "commands.log"), "utf8");
  assert.ok(log.split("\n").filter(Boolean).every((line) => line.startsWith("compose --env-file .env.production ")));
  assert.ok(log.indexOf("BACKUP_ONCE=1") < log.indexOf("build api web"));
  assert.ok(log.indexOf("build api web") < log.indexOf("up -d --no-build"));
  for (const setting of ["FAIL_CONFIG", "FAIL_TOOLING", "FAIL_BACKUP", "FAIL_BUILD"]) {
    const result = run({ [setting]: "1" });
    assert.notEqual(result.status, 0, `${setting} must abort`);
    const failed = readFileSync(join(directory, "commands.log"), "utf8");
    assert.ok(!failed.includes("up -d"), `${setting} must not restart containers`);
    if (setting !== "FAIL_BUILD") assert.ok(!failed.includes("build api web"));
  }
}));
