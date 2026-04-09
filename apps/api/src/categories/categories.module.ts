import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { CreateCategoryHandler } from "./commands/create-category.command"
import { UpdateCategoryHandler } from "./commands/update-category.command"
import { DeleteCategoryHandler } from "./commands/delete-category.command"
import { SeedDefaultCategoriesHandler } from "./commands/seed-default-categories.command"
import { GetCategoriesHandler } from "./queries/get-categories.query"
import { UserRegisteredHandler } from "./event-handlers/user-registered.handler"
import { CategoryRepository } from "./category.repository"
import { CategoriesController } from "./categories.controller"

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
