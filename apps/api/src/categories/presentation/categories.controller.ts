import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { AuthGuard } from "../../auth/presentation/auth.guard"
import { CurrentUser } from "../../auth/presentation/auth.decorator"
import { type AccessTokenPayload } from "../../auth/infrastructure/services/jwt.service"
import { CreateCategoryCommand } from "../application/commands/create-category.command"
import { UpdateCategoryCommand } from "../application/commands/update-category.command"
import { DeleteCategoryCommand } from "../application/commands/delete-category.command"
import { GetCategoriesQuery } from "../application/queries/get-categories.query"
import { Category } from "../domain/entities/category.entity"
import { CategoriesExceptionFilter } from "./categories-exception.filter"
import { CreateCategoryDto } from "./dto/create-category.dto"
import { UpdateCategoryDto } from "./dto/update-category.dto"

@Controller("categories")
@UseGuards(AuthGuard)
@UseFilters(CategoriesExceptionFilter)
export class CategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenPayload) {
    const categories = await this.queryBus.execute(
      new GetCategoriesQuery(user.sub)
    )
    return categories.map((c: Category) => ({
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      icon: c.icon,
    }))
  }

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateCategoryDto
  ) {
    const category = await this.commandBus.execute(
      new CreateCategoryCommand(
        user.sub,
        dto.name,
        dto.parentId ?? null,
        dto.icon ?? null
      )
    )
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      icon: category.icon,
    }
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto
  ) {
    const category = await this.commandBus.execute(
      new UpdateCategoryCommand(id, user.sub, dto.name, dto.icon)
    )
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      icon: category.icon,
    }
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string
  ) {
    await this.commandBus.execute(new DeleteCategoryCommand(id, user.sub))
    return { message: "Category deleted" }
  }
}
