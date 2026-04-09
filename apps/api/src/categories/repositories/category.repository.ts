import { Inject, Injectable } from "@nestjs/common"
import { eq, and } from "drizzle-orm"
import { type DbClient, categories } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { Category } from "../domain/entities/category.entity"

@Injectable()
export class CategoryRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findAllByUserId(userId: string): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
    return rows.map(Category.fromPersistence)
  }

  async findById(id: string, userId: string): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1)
    if (rows.length === 0) return null
    return Category.fromPersistence(rows[0])
  }

  async save(category: Category): Promise<Category> {
    if (category.id === "") {
      const rows = await this.db
        .insert(categories)
        .values({
          userId: category.userId,
          parentId: category.parentId,
          name: category.name,
          icon: category.icon,
        })
        .returning()
      return Category.fromPersistence(rows[0])
    }
    const rows = await this.db
      .update(categories)
      .set({
        name: category.name,
        icon: category.icon,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, category.id))
      .returning()
    return Category.fromPersistence(rows[0])
  }

  async saveMany(cats: Category[]): Promise<Category[]> {
    if (cats.length === 0) return []
    const rows = await this.db
      .insert(categories)
      .values(
        cats.map((cat) => ({
          userId: cat.userId,
          parentId: cat.parentId,
          name: cat.name,
          icon: cat.icon,
        }))
      )
      .returning()
    return rows.map(Category.fromPersistence)
  }

  async delete(id: string, userId: string): Promise<void> {
    // Delete subcategories first, then parent
    await this.db
      .delete(categories)
      .where(and(eq(categories.parentId, id), eq(categories.userId, userId)))
    await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  }
}
