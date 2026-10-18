//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import betterTailwindcss from "eslint-plugin-better-tailwindcss"
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults"
import {
  MatcherType,
  SelectorKind,
} from "eslint-plugin-better-tailwindcss/types"

export default [
  { ignores: [".output/**"] },
  ...tanstackConfig,
  {
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: new URL(
          "../../packages/ui/src/styles/globals.css",
          import.meta.url
        ).pathname,
        rootFontSize: 16,
        selectors: [
          ...getDefaultSelectors(),
          {
            kind: SelectorKind.Variable,
            name: "^[A-Z][A-Z0-9_]*$",
            match: [{ type: MatcherType.String }],
          },
        ],
      },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      "better-tailwindcss/enforce-canonical-classes": [
        "warn",
        { ignore: ["rounded-", String.raw`^border-\(--color-border\)$`] },
      ],
    },
  },
]
