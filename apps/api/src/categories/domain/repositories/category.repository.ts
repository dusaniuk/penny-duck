import { Category } from "../entities/category.entity"

export abstract class CategoryRepository {
  abstract findAllByUserId(userId: string): Promise<Category[]>
  abstract findById(id: string, userId: string): Promise<Category | null>
  abstract save(category: Category): Promise<Category>
  abstract saveMany(categories: Category[]): Promise<Category[]>
  abstract delete(id: string, userId: string): Promise<void>
}
