import { User } from "../../domain/entities/user.entity"

interface UserRow {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.fromPersistence({
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
