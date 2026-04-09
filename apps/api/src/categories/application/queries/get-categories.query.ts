import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { Category } from "../../domain/entities/category.entity"
import { CategoryRepository } from "../../repositories/category.repository"

export class GetCategoriesQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetCategoriesQuery)
export class GetCategoriesHandler implements IQueryHandler<GetCategoriesQuery> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(query: GetCategoriesQuery): Promise<Category[]> {
    return this.categoryRepo.findAllByUserId(query.userId)
  }
}
