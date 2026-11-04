import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

test("resource monitor reports failures, missing mounts and heartbeat delivery errors", () => {
  const root = resolve(import.meta.dirname, "..", "..");
  const directory = mkdtempSync(join(tmpdir(), "flocksync-monitor-test-"));
  try {
    mkdirSync(join(directory, "bin"));
    mkdirSync(join(directory, "deploy"));
    writeFileSync(join(directory, ".env"), "");
    writeFileSync(join(directory, "docker-compose.yml"), "services: {}");
    writeFileSync(join(directory, "deploy", "check-server.sh"), readFileSync(join(root, "deploy", "check-server.sh")));
    writeFileSync(join(directory, "deploy", "check-resources.mjs"), "// test stdin");
    writeFileSync(join(directory, "bin", "docker"), `#!/bin/sh
cat >/dev/null
echo '{"event":"test_probe"}'
exit "\${PROBE_EXIT:-0}"
`);
    writeFileSync(join(directory, "bin", "mountpoint"), `#!/bin/sh
exit "\${MOUNT_EXIT:-0}"
`);
    writeFileSync(join(directory, "bin", "curl"), `#!/bin/sh
printf '%s\\n' "$*" > /work/heartbeat.log
if [ "\${REJECT_HEARTBEAT:-0}" = "1" ]; then echo '{"ok":false}'; else echo '{"ok":true}'; fi
exit "\${DELIVERY_EXIT:-0}"
`);
    const run = (environment = {}) => {
      writeFileSync(join(directory, "heartbeat.log"), "");
      const result = spawnSync("docker", ["run", "--rm",
        "--mount", `type=bind,source=${directory},target=/work`, "-w", "/work",
        "-e", "MONITOR_CURL_CONFIG=/private/test-placeholder",
        ...Object.entries(environment).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
        "--entrypoint", "/bin/sh", "flocksync-backup:update-tests", "-c",
        "chmod +x /work/bin/*; export PATH=/work/bin:$PATH; sh deploy/check-server.sh"], {
        encoding: "utf8", timeout: 30_000
      });
      return { result, heartbeat: readFileSync(join(directory, "heartbeat.log"), "utf8") };
    };
    const healthy = run();
    assert.equal(healthy.result.status, 0, healthy.result.stderr);
    assert.match(healthy.heartbeat, /status=up/);
    const failed = run({ PROBE_EXIT: "2" });
    assert.equal(failed.result.status, 1);
    assert.match(failed.heartbeat, /status=down/);
    const unmounted = run({ BACKUP_MOUNTPOINT: "/test", MOUNT_EXIT: "1" });
    assert.equal(unmounted.result.status, 1);
    assert.match(unmounted.heartbeat, /status=down/);
    assert.ok(!unmounted.result.stdout.includes("test_probe"));
    const rejected = run({ DELIVERY_EXIT: "22" });
    assert.equal(rejected.result.status, 1);
    assert.match(rejected.result.stderr, /monitor_delivery_failed/);
    const invalidToken = run({ REJECT_HEARTBEAT: "1" });
    assert.equal(invalidToken.result.status, 1);
    assert.match(invalidToken.result.stderr, /monitor_delivery_failed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
