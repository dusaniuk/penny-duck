import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { GetCurrentUserHandler } from "./queries/get-current-user.query"
import { GetMembersHandler } from "./queries/get-members.query"
import { UpdateProfileHandler } from "./commands/update-profile.command"
import { UserRepository } from "./user.repository"
import { UsersController } from "./users.controller"

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule],
  controllers: [UsersController],
  providers: [
    GetCurrentUserHandler,
    GetMembersHandler,
    UpdateProfileHandler,
    UserRepository,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
