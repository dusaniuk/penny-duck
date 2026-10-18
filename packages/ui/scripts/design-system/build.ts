// Regenerates the Penny Duck design system artifact's files into
// dist/design-system/, laid out like the artifact's project/ folder:
//   tokens.json              colours, radii and font stacks from the code
//   fonts/*.woff2            the app's variable fonts
//   components/bundle.js     IIFE assigning window.PennyDuck
//   components/bundle.css    the app's Tailwind output
//   components/lib/*.js      React and ReactDOM as window globals
//
// Pass the artifact's current tokens.json as --base to keep its usage notes,
// type styles, spacing and sizes; the script prints what changed against it.

import { execFileSync } from "node:child_process"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { build } from "esbuild"
import { compile, optimize } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import {
  NEUTRAL_COLOR,
  PALETTE_TOKENS,
  paletteColor,
} from "../../../../apps/web/src/lib/palette"
import { colorTokens, findBlock, mergeTokens, themeTokens } from "./tokens"
import type { Plugin } from "esbuild"
import type { Tokens } from "./tokens"

const NAMESPACE = "PennyDuck"

const COMPONENTS: Record<string, string> = {
  Button: "packages/ui/src/components/button.tsx",
  Badge: "packages/ui/src/components/badge.tsx",
  Card: "packages/ui/src/components/card.tsx",
  Input: "packages/ui/src/components/input.tsx",
  Textarea: "packages/ui/src/components/textarea.tsx",
  Label: "packages/ui/src/components/label.tsx",
  Field: "packages/ui/src/components/field.tsx",
  InputGroup: "packages/ui/src/components/input-group.tsx",
  Switch: "packages/ui/src/components/switch.tsx",
  Select: "packages/ui/src/components/select.tsx",
  Combobox: "packages/ui/src/components/combobox.tsx",
  SelectableSurface: "packages/ui/src/components/selectable-surface.tsx",
  CategoryIconChip: "apps/web/src/components/categories/category-icon-chip.tsx",
  Amount: "packages/ui/src/components/amount.tsx",
  PageHeader: "apps/web/src/components/page-header.tsx",
  Avatar: "packages/ui/src/components/avatar.tsx",
  Breadcrumb: "packages/ui/src/components/breadcrumb.tsx",
  Tabs: "packages/ui/src/components/tabs.tsx",
  Separator: "packages/ui/src/components/separator.tsx",
  Skeleton: "packages/ui/src/components/skeleton.tsx",
  Table: "packages/ui/src/components/table.tsx",
  Calendar: "packages/ui/src/components/calendar.tsx",
  Collapsible: "packages/ui/src/components/collapsible.tsx",
  Tooltip: "packages/ui/src/components/tooltip.tsx",
  Popover: "packages/ui/src/components/popover.tsx",
  DropdownMenu: "packages/ui/src/components/dropdown-menu.tsx",
  Command: "packages/ui/src/components/command.tsx",
  Dialog: "packages/ui/src/components/dialog.tsx",
  AlertDialog: "packages/ui/src/components/alert-dialog.tsx",
  Sheet: "packages/ui/src/components/sheet.tsx",
  Drawer: "packages/ui/src/components/drawer.tsx",
  ResponsiveDialog: "packages/ui/src/components/responsive-dialog.tsx",
  FormDialog: "packages/ui/src/components/form-dialog.tsx",
  Chart: "packages/ui/src/components/chart.tsx",
  Sidebar: "packages/ui/src/components/sidebar.tsx",
}

const FONTS = ["instrument-sans", "space-grotesk"]

const here = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(here, "../..")
const repoRoot = path.resolve(uiRoot, "../..")
const outDir = path.join(uiRoot, "dist/design-system")
const stylesDir = path.join(uiRoot, "src/styles")
const webRoot = path.join(repoRoot, "apps/web")

const reactGlobals: Plugin = {
  name: "react-globals",
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({
      path: args.path,
      namespace: "react-globals",
    }))
    b.onLoad({ filter: /.*/, namespace: "react-globals" }, (args) => {
      if (/^react\/jsx(-dev)?-runtime$/.test(args.path)) {
        return {
          contents: `
            const R = window.React
            function split(props, key) {
              const { children, ...rest } = props
              if (key !== undefined) rest.key = key
              return [rest, children]
            }
            function jsx(type, props, key) {
              const [rest, children] = split(props, key)
              return children === undefined
                ? R.createElement(type, rest)
                : R.createElement(type, rest, children)
            }
            function jsxs(type, props, key) {
              const [rest, children] = split(props, key)
              return R.createElement(type, rest, ...children)
            }
            module.exports = { Fragment: R.Fragment, jsx, jsxs, jsxDEV: jsx }
          `,
          loader: "js",
        }
      }
      const global = args.path.startsWith("react-dom") ? "ReactDOM" : "React"
      return { contents: `module.exports = window.${global}`, loader: "js" }
    })
  },
}

const iife = {
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2022",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
} as const

async function buildJs() {
  const result = await build({
    ...iife,
    entryPoints: [path.join(here, "entry.ts")],
    globalName: NAMESPACE,
    jsx: "automatic",
    plugins: [reactGlobals],
  })
  const code = result.outputFiles[0].text
  if (/<\/script|<!--/i.test(code)) {
    throw new Error(
      "bundle.js contains </script or <!--, which breaks inlining"
    )
  }
  const header = JSON.stringify({
    format: 4,
    namespace: NAMESPACE,
    components: Object.keys(COMPONENTS).map((name) => ({ name })),
  })
  return `/* @ds-bundle: ${header} */\n${code}`
}

// The artifact loads React and ReactDOM as classic scripts before bundle.js.
async function buildReactLibs() {
  const reactGlobal: Plugin = {
    name: "react-global",
    setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({
        path: "react",
        namespace: "react-global",
      }))
      b.onLoad({ filter: /.*/, namespace: "react-global" }, () => ({
        contents: "module.exports = window.React",
        loader: "js",
      }))
    },
  }
  const lib = async (contents: string, plugins: Array<Plugin> = []) => {
    const result = await build({
      ...iife,
      stdin: { contents, resolveDir: uiRoot, loader: "js" },
      plugins,
    })
    return result.outputFiles[0].text
  }
  const [react, reactDom] = await Promise.all([
    lib(`import * as React from "react"; window.React = React`),
    lib(
      `import * as ReactDOM from "react-dom"
       import * as Client from "react-dom/client"
       window.ReactDOM = Object.assign({}, ReactDOM, Client)`,
      [reactGlobal]
    ),
  ])
  return { react, reactDom }
}

// The artifact supplies the colour tokens (tokens.css) and font files itself
// and switches themes with [data-theme="dark"], so the app stylesheet is
// trimmed to the Tailwind layers and keyed to that attribute. The rounded-*
// utilities compile to calc(var(--radius) * n) and tokens.css has no
// --radius, so it is declared again.
function adaptGlobals(css: string): string {
  let out = css
    .replace(/^@import "@fontsource-variable\/[^"]+";\n/gm, "")
    .replace(
      "@custom-variant dark (&:is(.dark *));",
      '@custom-variant dark (&:is([data-theme="dark"] *));'
    )
  const radius = findBlock(out, ":root").body.match(/--radius:\s*([^;]+);/)
  if (!radius) throw new Error("globals.css :root has no --radius")
  for (const selector of [":root", ".dark"]) {
    const { start, end } = findBlock(out, selector)
    out = out.slice(0, start) + out.slice(end)
  }
  return `${out}\n:root {\n  --radius: ${radius[1]};\n}\n`
}

// Like the Vite plugin, scan the web app's root on top of the @source globs.
async function buildCss() {
  const source = await readFile(path.join(stylesDir, "globals.css"), "utf8")
  const compiler = await compile(adaptGlobals(source), {
    base: stylesDir,
    onDependency: () => {},
  })
  const sources = (
    compiler.root === "none"
      ? []
      : compiler.root === null
        ? [{ base: webRoot, pattern: "**/*", negated: false }]
        : [{ ...compiler.root, negated: false }]
  ).concat(compiler.sources)
  const scanner = new Scanner({ sources })
  const css = compiler.build(scanner.scan())
  return optimize(css, { minify: true }).code
}

function git(...args: Array<string>) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim()
}

async function buildTokens(basePath: string | undefined) {
  const css = await readFile(path.join(stylesDir, "globals.css"), "utf8")
  const palette: Array<[string, string]> = PALETTE_TOKENS.map((name) => [
    `palette-${name}`,
    paletteColor(name),
  ])
  palette.push(["palette-fallback", NEUTRAL_COLOR])
  const { radii, families } = themeTokens(css)
  const base = basePath
    ? (JSON.parse(await readFile(basePath, "utf8")) as Tokens)
    : undefined
  const branch = git("rev-parse", "--abbrev-ref", "HEAD")
  const sha = git("rev-parse", "--short", "HEAD")
  const dirty = git("status", "--porcelain") ? "+dirty" : ""
  return mergeTokens(base, {
    colors: colorTokens(css, palette),
    radii,
    families,
    meta: {
      source: "github",
      repo: "dusaniuk/penny-duck",
      ref: `${branch}@${sha}${dirty}`,
      package: "packages/ui",
      paths: {
        tokens: [
          "packages/ui/src/styles/globals.css",
          "apps/web/src/lib/palette.ts",
        ],
        fonts: FONTS.map((font) => `@fontsource-variable/${font}`),
      },
      components: COMPONENTS,
      synced: new Date().toISOString().slice(0, 10),
      build: "pnpm --filter @workspace/ui build:design-system",
    },
  })
}

const { values: args } = parseArgs({ options: { base: { type: "string" } } })

const [js, css, libs, { tokens, changes }] = await Promise.all([
  buildJs(),
  buildCss(),
  buildReactLibs(),
  buildTokens(args.base),
])

const componentsDir = path.join(outDir, "components")
await mkdir(path.join(componentsDir, "lib"), { recursive: true })
await mkdir(path.join(outDir, "fonts"), { recursive: true })
await Promise.all([
  writeFile(path.join(componentsDir, "bundle.js"), js),
  writeFile(path.join(componentsDir, "bundle.css"), css),
  writeFile(
    path.join(componentsDir, "lib/react.production.min.js"),
    libs.react
  ),
  writeFile(
    path.join(componentsDir, "lib/react-dom.production.min.js"),
    libs.reactDom
  ),
  writeFile(
    path.join(outDir, "tokens.json"),
    `${JSON.stringify(tokens, null, 2)}\n`
  ),
  ...FONTS.map((font) => {
    const file = `${font}-latin-wght-normal.woff2`
    return copyFile(
      path.join(
        uiRoot,
        "node_modules/@fontsource-variable",
        font,
        "files",
        file
      ),
      path.join(outDir, "fonts", file)
    )
  }),
])

const { version: reactVersion } = JSON.parse(
  await readFile(path.join(uiRoot, "node_modules/react/package.json"), "utf8")
) as { version: string }
const kb = (s: string) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`
const tokenReport = !args.base
  ? "no --base: usage notes are empty"
  : changes.length
    ? `changes vs base:\n  ${changes.join("\n  ")}`
    : "no token changes vs base"
console.log(
  [
    `bundle.js  ${kb(js)}`,
    `bundle.css ${kb(css)}`,
    `react      ${reactVersion}`,
    `tokens     ${tokens.color.tokens.length} colours`,
    tokenReport,
    `→ ${outDir}`,
  ].join("\n")
)
