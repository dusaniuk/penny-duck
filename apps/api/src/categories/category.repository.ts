import { Inject, Injectable } from "@nestjs/common"
import { eq, and } from "drizzle-orm"
import { type DbClient, categories } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type CategoryRow = typeof categories.$inferSelect

@Injectable()
export class CategoryRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findAllByOrganizationId(organizationId: string): Promise<CategoryRow[]> {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
  }

  async findById(id: string, organizationId: string): Promise<CategoryRow | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
      .limit(1)
    return rows[0] ?? null
  }

  async hasChildren(parentId: string, organizationId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.parentId, parentId),
          eq(categories.organizationId, organizationId)
        )
      )
      .limit(1)
    return rows.length > 0
  }

  async insert(data: {
    organizationId: string
    parentId: string | null
    name: string
    type: string
    icon: string | null
    color: string | null
  }): Promise<CategoryRow> {
    const [row] = await this.db
      .insert(categories)
      .values(data)
      .returning()
    return row
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string
      type?: string
      icon?: string | null
      parentId?: string | null
      color?: string | null
    }
  ): Promise<CategoryRow> {
    const [row] = await this.db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
      .returning()
    return row
  }

  async updateChildrenType(
    parentId: string,
    organizationId: string,
    type: string
  ): Promise<void> {
    await this.db
      .update(categories)
      .set({ type, updatedAt: new Date() })
      .where(and(eq(categories.parentId, parentId), eq(categories.organizationId, organizationId)))
  }

  async insertMany(
    items: Array<{
      organizationId: string
      parentId: string | null
      name: string
      type: string
      icon: string | null
    }>
  ): Promise<CategoryRow[]> {
    if (items.length === 0) return []
    return this.db.insert(categories).values(items).returning()
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.db
      .delete(categories)
      .where(and(eq(categories.parentId, id), eq(categories.organizationId, organizationId)))
    await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
  }
}
