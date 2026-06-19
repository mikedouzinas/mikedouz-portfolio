import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Next 16 removed `next lint`; eslint-config-next 16 ships native flat configs,
// so we spread them directly instead of bridging legacy configs via FlatCompat
// (the FlatCompat path crashes under ESLint 9 with a circular-JSON error).
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
