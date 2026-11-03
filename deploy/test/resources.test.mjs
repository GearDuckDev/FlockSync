import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

test("representative sync, backup and 128 MiB restore preserve health with measured resource use", async () => {
  const project = `flocksync-resource-test-${randomUUID().slice(0, 8)}`;
  const root = resolve(import.meta.dirname, "..", "..");
  const segment = Math.floor(Math.random() * 200) + 10;
  const limited = process.env.C3_LIMITED === "1";
  const environment = { ...process.env,
    API_PROXY_SUBNET: `10.237.${segment}.0/29`, API_PROXY_IP: `10.237.${segment}.3`,
    TEST_API_IP: `10.237.${segment}.2`, TEST_CLIENT_IP: `10.237.${segment}.4`,
    TUNNEL_PROXY_SUBNET: `10.238.${segment}.0/29`,
    TUNNEL_WEB_IP: `10.238.${segment}.2`, TUNNEL_PROXY_IP: `10.238.${segment}.3`,
    NAS_BACKUP_PATH: ".", CLOUDFLARE_TUNNEL_TOKEN: "test-placeholder",
    TEST_API_MEMORY: limited ? "2g" : "0", TEST_API_CPUS: limited ? "2" : "0",
    TEST_API_PIDS: limited ? "128" : "0", TEST_WEB_MEMORY: limited ? "256m" : "0",
    TEST_WEB_CPUS: limited ? "1" : "0", TEST_WEB_PIDS: limited ? "128" : "0"
  };
  const args = ["compose", "--project-name", project, "--env-file", ".env.example",
    "-f", "docker-compose.yml", "-f", "deploy/test/health-test.override.yml",
    "-f", "deploy/test/resource-test.override.yml"];
  const docker = (command, input, expected = 0) => {
    const result = spawnSync("docker", command, { cwd: root, env: environment,
      encoding: "utf8", timeout: 360_000, ...(input ? { input } : {}) });
    assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
    return result.stdout.trim();
  };
  const compose = (...command) => docker([...args, ...command]);
  let sampler;
  let samples = "";
  try {
    const config = JSON.parse(compose("config", "--format", "json"));
    for (const service of ["api", "web", "db-backup", "cloudflared"]) {
      assert.equal(config.services[service].logging.driver, "local");
      assert.equal(config.services[service].logging.options["max-size"], "10m");
      assert.equal(config.services[service].logging.options["max-file"], "3");
    }
    compose("up", "-d", "--no-build", "--wait", "--wait-timeout", "90", "api", "web", "resource-client");
    compose("exec", "-T", "--user", "0", "api", "chown", "1000:1000", "/backups");
    const ids = ["api", "web"].map((service) => compose("ps", "-q", service));
    sampler = spawn("docker", ["stats", "--format", "{{json .}}", ...ids], {
      cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"]
    });
    sampler.stdout.on("data", (chunk) => { samples += chunk.toString(); });
    sampler.stderr.on("data", (chunk) => { samples += chunk.toString(); });
    compose("exec", "-T", "api", "node", "--input-type=module", "-e", `
      import Database from "better-sqlite3";
      const live = new Database("/app/data/flocksync.db");
      live.pragma("wal_checkpoint(TRUNCATE)");
      await live.backup("/backups/large.db"); live.close();
      const snapshot = new Database("/backups/large.db");
      const pages = snapshot.pragma("page_count", {simple:true});
      const size = snapshot.pragma("page_size", {simple:true});
      snapshot.pragma("secure_delete = OFF");
      snapshot.exec("CREATE TABLE resource_padding(value BLOB)");
      snapshot.prepare("INSERT INTO resource_padding VALUES (zeroblob(?))").run(128*1024*1024 - pages*size - 1024*1024);
      snapshot.exec("DROP TABLE resource_padding");
      snapshot.close();
      const {truncate, stat} = await import("node:fs/promises");
      // Trailing bytes preserve the database schema while testing the exact upload boundary.
      await truncate("/backups/large.db", 128*1024*1024);
      if ((await stat("/backups/large.db")).size !== 128*1024*1024) throw new Error("Wrong fixture size");
    `);
    console.log(docker([...args, "exec", "-T", "-e", `RESOURCE_BASELINE=${limited ? "0" : "1"}`,
      "resource-client", "node", "--input-type=module"],
      readFileSync(resolve(import.meta.dirname, "resource-workload.mjs"), "utf8")));
    if (limited) {
      console.log(docker([...args, "exec", "-T", "resource-client", "node", "--input-type=module"],
        readFileSync(resolve(import.meta.dirname, "request-guards.mjs"), "utf8")));
    }
    console.log(compose("run", "--rm", "--no-deps", "--entrypoint", "/bin/sh", "db-backup", "-c",
      "/bin/sh /usr/local/bin/backup-sqlite && printf 'Scheduled backup memory peak bytes: ' && cat /sys/fs/cgroup/memory.peak"));
    console.log(docker([...args, "exec", "-T", "api", "node", "--input-type=module"],
      readFileSync(resolve(root, "deploy", "check-resources.mjs"), "utf8")));
    const pressure = docker([...args, "exec", "-T", "-e", "RESOURCE_MIN_FREE_BYTES=9000000000000000",
      "api", "node", "--input-type=module"],
      readFileSync(resolve(root, "deploy", "check-resources.mjs"), "utf8"), 2);
    assert.match(pressure, /resource_check_degraded/);
    for (const id of ids) {
      const inspection = JSON.parse(docker(["inspect", id]))[0];
      assert.equal(inspection.RestartCount, 0);
      assert.equal(inspection.State.OOMKilled, false);
      assert.equal(inspection.State.Health.Status, "healthy");
      if (limited) {
        assert.ok(inspection.HostConfig.Memory > 0);
        assert.ok(inspection.HostConfig.NanoCpus > 0);
        assert.equal(inspection.HostConfig.PidsLimit, 128);
      }
    }
    console.log(compose("exec", "-T", "api", "node", "--input-type=module", "-e", `
      import {readFile, statfs, stat} from "node:fs/promises";
      const read = async path => {try{return (await readFile(path,"utf8")).trim()}catch(error){if(error.code==="ENOENT")return "unsupported";throw error}};
      console.log(JSON.stringify({event:"resource_baseline",memoryPeak:await read("/sys/fs/cgroup/memory.peak"),
        cpu:await read("/sys/fs/cgroup/cpu.stat"),pidsPeak:await read("/sys/fs/cgroup/pids.peak"),
        databaseBytes:(await stat("/app/data/flocksync.db")).size,
        dataFreeBytes:(await statfs("/app/data")).bavail*(await statfs("/app/data")).bsize,
        backupFreeBytes:(await statfs("/backups")).bavail*(await statfs("/backups")).bsize}));
    `));
  } catch (error) {
    console.error(compose("logs", "--no-color", "--tail", "30", "api", "web"));
    throw error;
  } finally {
    if (sampler && sampler.exitCode === null && sampler.signalCode === null) {
      const exited = new Promise((resolveExit) => sampler.once("exit", resolveExit));
      sampler.kill();
      await exited;
    }
    console.log(`Docker resource samples (limited=${limited}):\n${samples.slice(-6000)}`);
    compose("down", "--volumes", "--timeout", "5", "--remove-orphans");
  }
});
