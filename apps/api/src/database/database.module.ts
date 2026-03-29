import { Global, Module } from "@nestjs/common"
import { createDbClient } from "@workspace/db"
import { env } from "@workspace/env/api"

export const DB_CLIENT = Symbol("DB_CLIENT")

@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      useFactory: () => createDbClient(env.DATABASE_URL),
    },
  ],
  exports: [DB_CLIENT],
})
export class DatabaseModule {}
