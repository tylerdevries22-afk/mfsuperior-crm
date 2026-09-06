/* global __dirname */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const { transformSync } = require("@babel/core");
const { transpileModule, ModuleKind } = require("typescript");
const { expoInlineEnvVars } = require("babel-preset-expo/build/plugins/inline-env-vars");

const root = resolve(__dirname, "..");
const keys = [
  "EXPO_PUBLIC_DEMO_AUTH_ENABLED", "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_MOBILE_PARITY_V2", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_SUPABASE_URL",
];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

// Run Expo's actual production environment transform, then execute with an
// empty device environment. Node-only config tests cannot catch missing inlining.
function loadDeviceModule(filename) {
  const source = transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const { code } = transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    caller: { name: "metro", isDev: false, isServer: false, platform: "ios" },
    plugins: [expoInlineEnvVars],
  });
  const module = { exports: {} };
  runInNewContext(code, {
    module, exports: module.exports, process: { env: {} }, URL,
    require: (name) => loadDeviceModule(resolve(filename, "..", `${name}.ts`)),
  }, { timeout: 1000 });
  return module.exports;
}

try {
  for (const key of keys) delete process.env[key];
  const file = resolve(root, "lib/auth/config.ts");
  assert.equal(loadDeviceModule(file).resolveAuthRuntimeConfig().mode, "unconfigured");
  process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED = "true";
  assert.equal(loadDeviceModule(file).resolveAuthRuntimeConfig().mode, "demo");
  delete process.env.EXPO_PUBLIC_DEMO_AUTH_ENABLED;
  Object.assign(process.env, {
    EXPO_PUBLIC_API_BASE_URL: "https://example.com/api/mobile",
    EXPO_PUBLIC_MOBILE_PARITY_V2: "true",
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  });
  const runtime = loadDeviceModule(file).resolveAuthRuntimeConfig();
  assert.equal(runtime.mode, "production");
  assert.equal(runtime.config.apiBaseUrl, "https://example.com/api/mobile");
  process.stdout.write("Device environment checks passed: demo, production, and fail-closed.\n");
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}
