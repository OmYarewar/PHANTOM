import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["server/**/*.js", "frontend/js/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "warn",
            "no-undef": "off",
            "no-empty": "off",
            "no-case-declarations": "off",
            "no-control-regex": "off"
        }
    }
];
