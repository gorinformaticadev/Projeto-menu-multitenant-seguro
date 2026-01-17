import { createRequire } from "module";
const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");

export default nextConfig.map(c => {
    if (c.name === 'next/typescript' || (c.plugins && c.plugins['@typescript-eslint'])) {
        return {
            ...c,
            rules: {
                ...c.rules,
                "@typescript-eslint/no-explicit-any": "warn",
                "@typescript-eslint/no-unused-vars": "warn",
                "@typescript-eslint/prefer-ts-expect-error": "warn",
                "@typescript-eslint/ban-ts-comment": "warn"
            }
        };
    }
    if (c.name === 'next' || (c.plugins && (c.plugins['@next/next'] || c.plugins['react-hooks']))) {
        return {
            ...c,
            rules: {
                ...c.rules,
                "react/no-unescaped-entities": "warn",
                "@next/next/no-assign-module-variable": "warn",
                "@next/next/no-img-element": "warn",
                "react-hooks/set-state-in-effect": "warn",
                "react-hooks/immutability": "warn",
                "react-hooks/exhaustive-deps": "warn",
                "react-hooks/purity": "warn",
                "react-hooks/static-components": "warn",
            }
        };
    }
    return c;
});
