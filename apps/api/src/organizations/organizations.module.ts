import { Module } from "@nestjs/common"
import { DatabaseModule } from "@/database/database.module"
import { OrganizationRepository } from "./organization.repository"

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationRepository],
  exports: [OrganizationRepository],
})
export class OrganizationsModule {}
