// Builds the live bundle for the Penny Duck design system artifact:
//   dist/design-system/components/bundle.js   IIFE assigning window.PennyDuck
//   dist/design-system/components/bundle.css  the app's Tailwind output
// React and ReactDOM are not bundled: the artifact preloads them as globals.
// Publish both files to the artifact's project/components/ folder.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { compile, optimize } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import type { Plugin } from "esbuild"

const NAMESPACE = "PennyDuck"

const COMPONENTS = [
  "Button",
  "Badge",
  "Card",
  "Input",
  "Textarea",
  "Label",
  "Field",
  "InputGroup",
  "Switch",
  "Select",
  "Combobox",
  "SelectableSurface",
  "CategoryIconChip",
  "Amount",
  "PageHeader",
  "Avatar",
  "Breadcrumb",
  "Tabs",
  "Separator",
  "Skeleton",
  "Table",
  "Calendar",
  "Collapsible",
  "Tooltip",
  "Popover",
  "DropdownMenu",
  "Command",
  "Dialog",
  "AlertDialog",
  "Sheet",
  "Drawer",
  "ResponsiveDialog",
  "FormDialog",
  "Chart",
  "Sidebar",
]

const here = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(here, "../..")
const outDir = path.join(uiRoot, "dist/design-system/components")
const stylesDir = path.join(uiRoot, "src/styles")
const webRoot = path.resolve(uiRoot, "../../apps/web")

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

async function buildJs() {
  const result = await build({
    entryPoints: [path.join(here, "entry.ts")],
    bundle: true,
    format: "iife",
    globalName: NAMESPACE,
    minify: true,
    write: false,
    jsx: "automatic",
    target: "es2022",
    legalComments: "none",
    define: { "process.env.NODE_ENV": '"production"' },
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
    components: COMPONENTS.map((name) => ({ name })),
  })
  return `/* @ds-bundle: ${header} */\n${code}`
}

// The artifact supplies the colour tokens (tokens.css) and font files itself
// and switches themes with [data-theme="dark"], so the app stylesheet is
// trimmed to the Tailwind layers and keyed to that attribute.
function adaptGlobals(css: string): string {
  let out = css
    .replace(/^@import "@fontsource-variable\/[^"]+";\n/gm, "")
    .replace(
      "@custom-variant dark (&:is(.dark *));",
      '@custom-variant dark (&:is([data-theme="dark"] *));'
    )
  for (const selector of [":root", ".dark"]) {
    const start = out.indexOf(`\n${selector} {`)
    if (start === -1) throw new Error(`globals.css has no ${selector} block`)
    let depth = 0
    let end = out.indexOf("{", start)
    for (; end < out.length; end++) {
      if (out[end] === "{") depth++
      else if (out[end] === "}" && --depth === 0) break
    }
    out = out.slice(0, start) + out.slice(end + 1)
  }
  return out
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

const [js, css] = await Promise.all([buildJs(), buildCss()])
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, "bundle.js"), js)
await writeFile(path.join(outDir, "bundle.css"), css)

const kb = (s: string) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`
console.log(`bundle.js  ${kb(js)}\nbundle.css ${kb(css)}\n→ ${outDir}`)
