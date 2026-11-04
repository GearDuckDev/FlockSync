import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..", "..");
const project = `flocksync-proxy-test-${randomUUID().slice(0, 8)}`;
// Separate from deployment defaults; Docker rejects overlaps instead of joining another network.
const segment = Math.floor(Math.random() * 200) + 10;
const environment = { ...process.env,
  API_PROXY_SUBNET: `10.233.${segment}.0/29`, API_PROXY_IP: `10.233.${segment}.3`,
  TUNNEL_PROXY_SUBNET: `10.234.${segment}.0/29`, TUNNEL_PROXY_IP: `10.234.${segment}.3`,
  TUNNEL_WEB_IP: `10.234.${segment}.2`, TEST_UNTRUSTED_IP: `10.234.${segment}.4`,
  NAS_BACKUP_PATH: root, CLOUDFLARE_TUNNEL_TOKEN: "test-placeholder-not-a-real-tunnel"
};
const composeArgs = ["compose", "--project-name", project, "--env-file", ".env.example",
  "-f", "docker-compose.yml", "-f", "deploy/test/proxy-test.override.yml"];
const docker = (args) => {
  const result = spawnSync("docker", args, {
    cwd: root, env: environment, encoding: "utf8", timeout: 180_000
  });
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
  return result.stdout.trim();
};
const compose = (args) => docker([...composeArgs, ...args]);
const send = (service, url, headers = {}) => JSON.parse(compose([
  "exec", "-T", service, "node", "--input-type=module", "-e", `
    const { url, headers } = JSON.parse(process.argv[1]);
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ email: "missing@example.com", password: "wrong" }),
        signal: AbortSignal.timeout(3000)
      });
      console.log(JSON.stringify({ status: response.status, retry: response.headers.get("retry-after") }));
    } catch (error) {
      console.log(JSON.stringify({ networkError: error.message }));
    }
  `, JSON.stringify({ url, headers })
]));
const publicLogin = "http://web/api/auth/login";
const forged = (ip) => ({
  "cf-connecting-ip": ip, "x-forwarded-for": ip, "x-real-ip": ip
});

test("isolated Compose proxies reject forged client IPs and preserve separate visitor allowances", () => {
  let started = false;
  try {
    const config = JSON.parse(compose(["config", "--format", "json"]));
    assert.equal(config.services.api.environment.TRUSTED_PROXY_IP, environment.API_PROXY_IP);
    assert.equal(config.services.web.networks.api_proxy.ipv4_address, environment.API_PROXY_IP);
    assert.equal(config.services.cloudflared.networks.tunnel_proxy.ipv4_address, environment.TUNNEL_PROXY_IP);
    assert.equal(config.networks.api_proxy.internal, true);
    assert.ok(!config.services.api.ports?.length);
    assert.ok(!config.services.web.ports?.length);
    assert.deepEqual(Object.keys(config.services.cloudflared.networks), ["tunnel_proxy"]);
    assert.ok(!("api_proxy" in config.services["db-backup"].networks));
    started = true;
    compose(["up", "-d", "--no-build", "--wait", "--wait-timeout", "90",
      "api", "web", "cloudflared", "untrusted", "direct"]);
    compose(["exec", "-T", "web", "nginx", "-t"]);

    // This stub occupies cloudflared's address; it emulates edge-supplied visitor headers only.
    for (const ip of ["198.51.100.10", "198.51.100.11", "2001:db8::1"]) {
      assert.equal(send("cloudflared", publicLogin, {
        "cf-connecting-ip": ip, "x-forwarded-for": "203.0.113.99, 203.0.113.100"
      }).status, 401);
      assert.equal(send("cloudflared", publicLogin, { "cf-connecting-ip": ip }).status, 401);
      const blocked = send("cloudflared", publicLogin, {
        "cf-connecting-ip": ip, "x-forwarded-for": "192.0.2.55"
      });
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.retry) > 0);
    }

    // Direct nginx peers cannot choose a visitor IP by sending any of these headers.
    assert.equal(send("untrusted", publicLogin, forged("192.0.2.1")).status, 401);
    assert.equal(send("untrusted", publicLogin, forged("192.0.2.2")).status, 401);
    assert.equal(send("untrusted", publicLogin, forged("192.0.2.3")).status, 429);
    assert.equal(send("cloudflared", publicLogin, forged("not-an-ip")).status, 400);
    assert.equal(send("cloudflared", publicLogin, forged("198.51.100.12, 198.51.100.13")).status, 400);
    assert.equal(send("cloudflared", publicLogin).status, 401);
    assert.equal(send("cloudflared", publicLogin).status, 401);
    assert.equal(send("cloudflared", publicLogin).status, 429);

    // Even a peer on API egress cannot spoof nginx; the ingress-only peer cannot reach API at all.
    const directLogin = "http://api:3001/api/auth/login";
    assert.equal(send("direct", directLogin, forged("192.0.2.4")).status, 401);
    assert.equal(send("direct", directLogin, forged("192.0.2.5")).status, 401);
    assert.equal(send("direct", directLogin, forged("192.0.2.6")).status, 429);
    assert.ok(send("untrusted", directLogin).networkError);

    const apiId = compose(["ps", "-q", "api"]);
    const api = JSON.parse(docker(["inspect", apiId]))[0];
    const backendIp = api.NetworkSettings.Networks[`${project}_api_proxy`].IPAddress;
    assert.ok(send("untrusted", `http://${backendIp}:3001/api/auth/login`).networkError);
  } catch (error) {
    if (started) console.error(compose(["logs", "--no-color", "--tail", "60", "api", "web"]));
    throw error;
  } finally {
    if (started) compose(["down", "--timeout", "5", "--remove-orphans"]);
  }
});
