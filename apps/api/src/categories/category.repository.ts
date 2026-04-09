import { Inject, Injectable } from "@nestjs/common"
import { eq, and } from "drizzle-orm"
import { type DbClient, categories } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type CategoryRow = typeof categories.$inferSelect

@Injectable()
export class CategoryRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findAllByUserId(userId: string): Promise<CategoryRow[]> {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
  }

  async findById(id: string, userId: string): Promise<CategoryRow | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1)
    return rows[0] ?? null
  }

  async insert(data: {
    userId: string
    parentId: string | null
    name: string
    icon: string | null
  }): Promise<CategoryRow> {
    const [row] = await this.db
      .insert(categories)
      .values(data)
      .returning()
    return row
  }

  async update(
    id: string,
    data: { name?: string; icon?: string | null }
  ): Promise<CategoryRow> {
    const [row] = await this.db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning()
    return row
  }

  async insertMany(
    items: Array<{
      userId: string
      parentId: string | null
      name: string
      icon: string | null
    }>
  ): Promise<CategoryRow[]> {
    if (items.length === 0) return []
    return this.db.insert(categories).values(items).returning()
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(categories)
      .where(and(eq(categories.parentId, id), eq(categories.userId, userId)))
    await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  }
}
