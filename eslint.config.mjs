import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import uiTooltips from "./scripts/eslint-ui-tooltips.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: { "radar-ui": uiTooltips },
    rules: {
      "radar-ui/no-native-tooltip": "error",
      "radar-ui/shared-tooltip-only": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "daisyui",
              message: "本项目 UI 仅允许 shadcn base-nova，禁止 daisyUI。",
            },
            {
              name: "antd",
              message: "本项目 UI 仅允许 shadcn，禁止 antd。",
            },
            {
              name: "@mui/material",
              message: "本项目 UI 仅允许 shadcn，禁止 MUI。",
            },
            {
              name: "@mantine/core",
              message: "本项目 UI 仅允许 shadcn，禁止 Mantine。",
            },
            {
              name: "@heroui/react",
              message: "本项目 UI 仅允许 shadcn，禁止 HeroUI。",
            },
            {
              name: "@chakra-ui/react",
              message: "本项目 UI 仅允许 shadcn，禁止 Chakra。",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
