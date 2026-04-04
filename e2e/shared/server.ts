import { spawn } from "node:child_process"

export async function runMigrations(
  repoRoot: string,
  databaseUrl: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const migrate = spawn(
      "pnpm",
      ["--filter", "@workspace/db", "drizzle-kit", "migrate"],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      }
    )
    migrate.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Migration failed with code ${code}`))
    })
  })
}
