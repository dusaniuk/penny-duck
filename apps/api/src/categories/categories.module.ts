import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { CreateCategoryHandler } from "./application/commands/create-category.command"
import { UpdateCategoryHandler } from "./application/commands/update-category.command"
import { DeleteCategoryHandler } from "./application/commands/delete-category.command"
import { SeedDefaultCategoriesHandler } from "./application/commands/seed-default-categories.command"
import { GetCategoriesHandler } from "./application/queries/get-categories.query"
import { UserRegisteredHandler } from "./application/event-handlers/user-registered.handler"
import { CategoryRepository } from "./repositories/category.repository"
import { CategoriesController } from "./presentation/categories.controller"

const commandHandlers = [
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
  SeedDefaultCategoriesHandler,
]
const queryHandlers = [GetCategoriesHandler]
const eventHandlers = [UserRegisteredHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule],
  controllers: [CategoriesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    CategoryRepository,
  ],
})
export class CategoriesModule {}
