import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Category } from "@workspace/api-contract"
import { CategoryRepository } from "../../repositories/category.repository"

export class GetCategoriesQuery extends Query<Category[]> {
  constructor(public readonly userId: string) {
    super()
  }
}

@QueryHandler(GetCategoriesQuery)
export class GetCategoriesHandler implements IQueryHandler<GetCategoriesQuery> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(query: GetCategoriesQuery): Promise<Category[]> {
    const rows = await this.categoryRepo.findAllByUserId(query.userId)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parentId ?? null,
      icon: r.icon ?? null,
    }))
  }
}
