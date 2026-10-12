import { NAME_MAX_LENGTH } from "./organization"

const FALLBACK_NAME = "Google user"

export function mapGoogleProfile(profile: { name?: string | null }): {
  name: string
  image: undefined
} {
  const name = profile.name?.trim() || FALLBACK_NAME
  return { name: name.slice(0, NAME_MAX_LENGTH), image: undefined }
}
