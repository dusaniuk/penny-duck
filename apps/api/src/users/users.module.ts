import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { OrganizationsModule } from "@/organizations/organizations.module"
import { GetCurrentUserHandler } from "./queries/get-current-user.query"
import { GetMembersHandler } from "./queries/get-members.query"
import { ExportUserDataHandler } from "./queries/export-user-data.query"
import { UpdateProfileHandler } from "./commands/update-profile.command"
import { DeleteUserAccountHandler } from "./commands/delete-account.command"
import { UserRepository } from "./user.repository"
import { UsersController } from "./users.controller"

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule, OrganizationsModule],
  controllers: [UsersController],
  providers: [
    GetCurrentUserHandler,
    GetMembersHandler,
    ExportUserDataHandler,
    UpdateProfileHandler,
    DeleteUserAccountHandler,
    UserRepository,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
