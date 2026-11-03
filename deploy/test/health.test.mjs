import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

test("container readiness and root-written scheduled evidence work without a live tunnel", () => {
  const project = `flocksync-health-test-${randomUUID().slice(0, 8)}`;
  const segment = Math.floor(Math.random() * 200) + 10;
  const environment = { ...process.env,
    API_PROXY_SUBNET: `10.235.${segment}.0/29`, API_PROXY_IP: `10.235.${segment}.3`,
    TUNNEL_PROXY_SUBNET: `10.236.${segment}.0/29`,
    TUNNEL_WEB_IP: `10.236.${segment}.2`, TUNNEL_PROXY_IP: `10.236.${segment}.3`,
    NAS_BACKUP_PATH: ".", CLOUDFLARE_TUNNEL_TOKEN: "test-placeholder"
  };
  const args = ["compose", "--project-name", project, "--env-file", ".env.example",
    "-f", "docker-compose.yml", "-f", "deploy/test/health-test.override.yml"];
  const compose = (...command) => {
    const result = spawnSync("docker", [...args, ...command], {
      cwd: resolve(import.meta.dirname, "..", ".."), env: environment,
      encoding: "utf8", timeout: 180_000
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
    return result.stdout.trim();
  };
  const status = () => JSON.parse(compose("exec", "-T", "api", "node", "--input-type=module", "-e", `
    const base = "http://127.0.0.1:3001";
    const login = await fetch(base + "/api/auth/login", {method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({email:"health-admin@example.com",password:"test-only-health-admin-password"})});
    if (!login.ok) throw new Error("Test login failed");
    const {token} = await login.json();
    const response = await fetch(base + "/api/admin/health", {headers:{authorization:"Bearer " + token}});
    console.log(JSON.stringify({code:response.status, body:await response.json()}));
  `));
  try {
    compose("config", "--quiet");
    compose("up", "-d", "--no-build", "--wait", "--wait-timeout", "90", "api", "web");
    assert.equal(compose("exec", "-T", "web", "wget", "-qO-", "http://127.0.0.1/ready"), '{"status":"ok"}');
    assert.equal(status().body.status, "missing");
    compose("run", "--rm", "--no-deps", "db-backup");
    const verified = status();
    assert.equal(verified.code, 200);
    assert.equal(verified.body.status, "healthy");
    assert.ok(verified.body.lastVerifiedAt > 0);
    assert.equal(compose("exec", "-T", "api", "node", "--input-type=module", "-e", `
      import {readFile, stat} from "node:fs/promises";
      const state = JSON.parse(await readFile("/app/data/backup-health-scheduled-success.json","utf8"));
      const file = await stat("/backups/" + state.filename);
      if (file.uid !== 1000 || (file.mode & 0o777) !== 0o600) throw new Error("Unsafe backup ownership/permissions");
      console.log("private");
    `), "private");
    compose("exec", "-T", "api", "node", "--input-type=module", "-e", `
      import {readFile, writeFile} from "node:fs/promises";
      const state = JSON.parse(await readFile("/app/data/backup-health-scheduled-success.json","utf8"));
      await writeFile("/backups/" + state.filename, "corrupt");
    `);
    assert.equal(status().code, 503);
  } catch (error) {
    console.error(compose("logs", "--no-color", "--tail", "30", "api"));
    throw error;
  } finally {
    compose("down", "--volumes", "--timeout", "5", "--remove-orphans");
  }
});
