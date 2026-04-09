import { Inject, Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { type DbClient, users } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { User } from "../../domain/entities/user.entity"

@Injectable()
export class UserRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (rows.length === 0) return null
    return User.fromPersistence(rows[0])
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (rows.length === 0) return null
    return User.fromPersistence(rows[0])
  }

  async save(user: User): Promise<User> {
    if (user.id === "") {
      const rows = await this.db
        .insert(users)
        .values({
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
        })
        .returning()

      return User.fromPersistence(rows[0])
    }

    const rows = await this.db
      .update(users)
      .set({
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()

    return User.fromPersistence(rows[0])
  }
}
