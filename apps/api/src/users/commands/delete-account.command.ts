import { BadRequestException, Inject, NotFoundException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { and, eq, ne } from "drizzle-orm"
import { type DbClient, organizations, organizationMembers } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { UserRepository } from "../user.repository"

export class DeleteUserAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly confirmEmail: string
  ) {}
}

@CommandHandler(DeleteUserAccountCommand)
export class DeleteUserAccountHandler
  implements ICommandHandler<DeleteUserAccountCommand>
{
  constructor(
    private readonly userRepo: UserRepository,
    @Inject(DB_CLIENT) private readonly db: DbClient
  ) {}

  async execute(
    command: DeleteUserAccountCommand
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findById(command.userId)
    if (!user) {
      throw new NotFoundException("User not found")
    }

    if (user.email !== command.confirmEmail) {
      throw new BadRequestException("Email does not match")
    }

    // Find all orgs where this user is a member
    const userOrgs = await this.db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, command.userId))

    for (const membership of userOrgs) {
      if (membership.role === "owner") {
        // Check if there are other owners in this org
        const otherOwners = await this.db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(
                organizationMembers.organizationId,
                membership.organizationId
              ),
              eq(organizationMembers.role, "owner"),
              ne(organizationMembers.userId, command.userId)
            )
          )
          .limit(1)

        if (otherOwners.length === 0) {
          // Sole owner — delete the org (cascades to accounts, categories, transactions, members)
          await this.db
            .delete(organizations)
            .where(eq(organizations.id, membership.organizationId))
        }
      }
    }

    // Delete user (cascades to remaining memberships and refresh tokens; sets transactions.madeById to null)
    await this.userRepo.delete(command.userId)

    return { message: "Account deleted successfully" }
  }
}
