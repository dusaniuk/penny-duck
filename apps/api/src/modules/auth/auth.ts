import { betterAuth, type BetterAuthOptions } from "better-auth"
import { APIError, getOAuthState } from "better-auth/api"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey } from "@better-auth/api-key"
import {
  apikeys,
  authAccounts,
  sessions,
  users,
  verifications,
} from "@workspace/db"
import { env, isProduction } from "@workspace/env/api"
import { db } from "@/db"
import { logger } from "@/logger"
import {
  NAME_MAX_LENGTH,
  findMembershipOrgId,
  findOrgIdByInviteCode,
  provisionMembership,
  readInviteCode,
} from "./organization"
import { mapGoogleProfile } from "./google"
import { verifyPassword } from "./password"

const DAY_SECONDS = 60 * 60 * 24
const signUpDisabled = isProduction

async function currentOAuthState(): Promise<unknown> {
  try {
    return await getOAuthState()
  } catch {
    return null
  }
}

async function inviteCodeFor(
  context: { body?: unknown } | null
): Promise<string | null> {
  return readInviteCode(context?.body, await currentOAuthState())
}

const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
          disableSignUp: signUpDisabled,
          mapProfileToUser: mapGoogleProfile,
        },
      }
    : {}

export const authOptions = {
  baseURL: env.WEB_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: authAccounts,
      verification: verifications,
      apikey: apikeys,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: signUpDisabled,
    autoSignIn: true,
    password: { verify: verifyPassword },
  },
  user: {
    additionalFields: {
      homeCurrency: { type: "string", required: false, input: false },
      agreedToTermsAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 7 * DAY_SECONDS,
    updateAge: DAY_SECONDS,
    cookieCache: { enabled: true, maxAge: 300 },
    additionalFields: {
      activeOrganizationId: { type: "string", required: false, input: false },
    },
  },
  socialProviders: googleProvider,
  account: {
    encryptOAuthTokens: true,
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  rateLimit: {
    enabled: isProduction,
    storage: "memory",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  logger: {
    log: (level, message, ...args: unknown[]) => {
      const err = args.find((arg) => arg instanceof Error)
      const rest = args.filter((arg) => arg !== err)
      logger[level](
        { component: "better-auth", err, args: rest.length ? rest : undefined },
        message
      )
    },
  },
  onAPIError: {
    errorURL: `${env.WEB_URL}/login`,
  },
  advanced: {
    cookiePrefix: "penny-duck",
    database: { generateId: "uuid" },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (user.name.trim().length === 0) {
            throw new APIError("BAD_REQUEST", {
              code: "NAME_REQUIRED",
              message: "Name is required",
            })
          }
          if (user.name.length > NAME_MAX_LENGTH) {
            throw new APIError("BAD_REQUEST", {
              code: "NAME_TOO_LONG",
              message: `Name must be at most ${NAME_MAX_LENGTH} characters`,
            })
          }
          const inviteCode = await inviteCodeFor(context)
          if (inviteCode && !(await findOrgIdByInviteCode(inviteCode))) {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_INVITE",
              message: "Invalid invite link",
            })
          }
          return { data: { ...user, agreedToTermsAt: new Date() } }
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => {
          const organizationId =
            (await findMembershipOrgId(session.userId)) ??
            (await provisionMembership(
              session.userId,
              await inviteCodeFor(context)
            ))
          return { data: { ...session, activeOrganizationId: organizationId } }
        },
      },
    },
  },
  plugins: [
    apiKey({
      defaultPrefix: "pd_",
      requireName: true,
      rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 60 },
      permissions: { defaultPermissions: { inbox: ["write"] } },
    }),
  ],
  disabledPaths: ["/update-user"],
  telemetry: { enabled: false },
} satisfies BetterAuthOptions

export const auth = betterAuth(authOptions)
