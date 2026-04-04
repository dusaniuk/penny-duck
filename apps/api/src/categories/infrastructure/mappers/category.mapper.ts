import { Category } from "../../domain/entities/category.entity"

interface CategoryRow {
  id: string
  userId: string
  parentId: string | null
  name: string
  icon: string | null
  createdAt: Date
  updatedAt: Date
}

export class CategoryMapper {
  static toDomain(row: CategoryRow): Category {
    return Category.fromPersistence({
      id: row.id,
      userId: row.userId,
      parentId: row.parentId,
      name: row.name,
      icon: row.icon,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
