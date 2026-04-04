import { User } from "../entities/user.entity"

export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>
  abstract save(user: User): Promise<User>
}
