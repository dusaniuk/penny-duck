import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

export async function setup() {
  expand(
    config({ path: resolve(__dirname, "../../../../.env.test"), override: true })
  )

  const repoRoot = resolve(__dirname, "../../../..")

  await new Promise<void>((resolve, reject) => {
    const migrate = spawn(
      "pnpm",
      ["--filter", "@workspace/db", "db:migrate"],
      {
        cwd: repoRoot,
        env: { ...process.env },
        stdio: "pipe",
      }
    )
    migrate.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Migration failed with code ${code}`))
    })
  })
}
