import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { categoryContract } from "@workspace/api-contract"
import { AuthGuard } from "../../auth/presentation/auth.guard"
import { CurrentUser } from "../../auth/presentation/auth.decorator"
import { type AccessTokenPayload } from "../../auth/infrastructure/services/jwt.service"
import { CreateCategoryCommand } from "../application/commands/create-category.command"
import { UpdateCategoryCommand } from "../application/commands/update-category.command"
import { DeleteCategoryCommand } from "../application/commands/delete-category.command"
import { GetCategoriesQuery } from "../application/queries/get-categories.query"

@Controller()
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(categoryContract.list)
  handleList(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(categoryContract.list, async () => {
      const categories = await this.queryBus.execute(
        new GetCategoriesQuery(user.sub)
      )
      return { status: 200 as const, body: categories }
    })
  }

  @TsRestHandler(categoryContract.create)
  handleCreate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(categoryContract.create, async ({ body }) => {
      const category = await this.commandBus.execute(
        new CreateCategoryCommand(
          user.sub,
          body.name,
          body.parentId ?? null,
          body.icon ?? null
        )
      )
      return { status: 201 as const, body: category }
    })
  }

  @TsRestHandler(categoryContract.update)
  handleUpdate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(categoryContract.update, async ({ params, body }) => {
      const category = await this.commandBus.execute(
        new UpdateCategoryCommand(params.id, user.sub, body.name, body.icon)
      )
      return { status: 200 as const, body: category }
    })
  }

  @TsRestHandler(categoryContract.delete)
  handleDelete(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(categoryContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteCategoryCommand(params.id, user.sub)
      )
      return { status: 200 as const, body: { message: "Category deleted" } }
    })
  }
}
