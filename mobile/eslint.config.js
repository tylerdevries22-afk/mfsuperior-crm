const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const typescriptPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = defineConfig([
  globalIgnores(["dist/**", ".expo/**", "node_modules/**"]),
  expoConfig,
  {
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);
