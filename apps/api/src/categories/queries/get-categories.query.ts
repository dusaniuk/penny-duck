import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Category, type CategoryType } from "@workspace/api-contract"
import { CategoryRepository } from "../category.repository"

export class GetCategoriesQuery extends Query<Category[]> {
  constructor(public readonly organizationId: string) {
    super()
  }
}

@QueryHandler(GetCategoriesQuery)
export class GetCategoriesHandler implements IQueryHandler<GetCategoriesQuery> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(query: GetCategoriesQuery): Promise<Category[]> {
    const rows = await this.categoryRepo.findAllByOrganizationId(
      query.organizationId
    )

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as CategoryType,
      parentId: r.parentId ?? null,
      icon: r.icon ?? null,
    }))
  }
}
