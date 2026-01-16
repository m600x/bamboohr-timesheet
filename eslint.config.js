const { defineConfig } = require("eslint/config");
const globals = require("globals");

module.exports = defineConfig([
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "script",
            globals: {
                ...globals.node,
                ...globals.es2020
            }
        },
        rules: {
            indent: ["error", 4, { SwitchCase: 1 }],
            semi: ["error", "always"],
            "no-console": "off",
            "no-unused-vars": "warn"
        }
    }
]);