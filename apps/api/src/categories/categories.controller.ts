import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { categoryContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentOrg } from "../auth/auth.decorator"
import { CreateCategoryCommand } from "./commands/create-category.command"
import { UpdateCategoryCommand } from "./commands/update-category.command"
import { DeleteCategoryCommand } from "./commands/delete-category.command"
import { GetCategoriesQuery } from "./queries/get-categories.query"

@Controller()
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(categoryContract.list)
  handleList(@CurrentOrg() organizationId: string) {
    return tsRestHandler(categoryContract.list, async () => {
      const categories = await this.queryBus.execute(
        new GetCategoriesQuery(organizationId)
      )
      return { status: 200 as const, body: categories }
    })
  }

  @TsRestHandler(categoryContract.create)
  handleCreate(@CurrentOrg() organizationId: string) {
    return tsRestHandler(categoryContract.create, async ({ body }) => {
      const category = await this.commandBus.execute(
        new CreateCategoryCommand(
          organizationId,
          body.name,
          body.parentId ?? null,
          body.icon ?? null,
          body.type ?? "expense",
          body.color ?? null
        )
      )
      return { status: 201 as const, body: category }
    })
  }

  @TsRestHandler(categoryContract.update)
  handleUpdate(@CurrentOrg() organizationId: string) {
    return tsRestHandler(categoryContract.update, async ({ params, body }) => {
      const category = await this.commandBus.execute(
        new UpdateCategoryCommand(
          params.id,
          organizationId,
          body.name,
          body.icon,
          body.type,
          body.parentId,
          body.color
        )
      )
      return { status: 200 as const, body: category }
    })
  }

  @TsRestHandler(categoryContract.delete)
  handleDelete(@CurrentOrg() organizationId: string) {
    return tsRestHandler(categoryContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteCategoryCommand(params.id, organizationId)
      )
      return { status: 200 as const, body: { message: "Category deleted" } }
    })
  }
}
