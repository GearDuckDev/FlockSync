import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const moduleUrl = new URL('../dist/config/env.js', import.meta.url).href;

test('environment coercion, defaults, IPv4 and paired-admin refinement survive Zod migration', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'flocksync-env-contract-'));
  const run = (overrides = {}) => spawnSync(process.execPath, [
    '--input-type=module', '-e',
    `const { env } = await import(${JSON.stringify(moduleUrl)});
     console.log(JSON.stringify({
       port: env.PORT, host: env.HOST, registration: env.PUBLIC_REGISTRATION_ENABLED,
       rate: env.AUTH_LOGIN_RATE_LIMIT_MAX, proxy: env.TRUSTED_PROXY_IP
     }));`,
  ], {
    cwd, encoding: 'utf8',
    env: {
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL: join(cwd, 'unused.db'),
      JWT_SECRET: 'synthetic-test-secret-at-least-32-characters',
      ...overrides,
    },
  });
  try {
    const defaults = run();
    assert.equal(defaults.status, 0, defaults.stderr);
    assert.deepEqual(JSON.parse(defaults.stdout), {
      port: 3001, host: '0.0.0.0', registration: true, rate: 10,
    });
    const custom = run({
      PORT: '4321', PUBLIC_REGISTRATION_ENABLED: 'false',
      AUTH_LOGIN_RATE_LIMIT_MAX: '20', TRUSTED_PROXY_IP: '172.30.90.2',
    });
    assert.equal(custom.status, 0, custom.stderr);
    assert.deepEqual(JSON.parse(custom.stdout), {
      port: 4321, host: '0.0.0.0', registration: false, rate: 20, proxy: '172.30.90.2',
    });
    for (const [overrides, message] of [
      [{ PORT: 'invalid' }, /PORT/],
      [{ PORT: '70000' }, /PORT/],
      [{ TRUSTED_PROXY_IP: '256.0.0.1' }, /TRUSTED_PROXY_IP/],
      [{ TRUSTED_PROXY_IP: '::1' }, /TRUSTED_PROXY_IP/],
      [{ PUBLIC_REGISTRATION_ENABLED: 'yes' }, /PUBLIC_REGISTRATION_ENABLED/],
      [{ INITIAL_ADMIN_EMAIL: 'tester@example.com' }, /must be set together/],
    ]) {
      const result = run(overrides);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Invalid API environment configuration/);
      assert.match(result.stderr, message);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
