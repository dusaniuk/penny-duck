import { verifyPassword as verifyScrypt } from "better-auth/crypto"

const BCRYPT_PREFIX = "$2"

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string
  password: string
}): Promise<boolean> {
  if (hash.startsWith(BCRYPT_PREFIX)) {
    return Bun.password.verify(password, hash)
  }
  return verifyScrypt({ hash, password })
}
