//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  { ignores: [".output/**"] },
  ...tanstackConfig,
  {
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
]
