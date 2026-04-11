export { contract } from "./contract"

export {
  MessageSchema,
  ErrorResponseSchema,
  PaginatedResponseSchema,
} from "./schemas/common"

export {
  SignupSchema,
  LoginSchema,
  AuthUserSchema,
  authContract,
} from "./schemas/auth"

export {
  AccountSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  accountContract,
} from "./schemas/accounts"
export type { Account } from "./schemas/accounts"

export {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  categoryContract,
} from "./schemas/categories"
export type { Category } from "./schemas/categories"

export {
  TransactionSchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  ListTransactionsQuerySchema,
  CreateTransferSchema,
  UpdateTransferSchema,
  TransferResponseSchema,
  transactionContract,
} from "./schemas/transactions"
export type { Transaction } from "./schemas/transactions"

export {
  ExchangeRatesResponseSchema,
  exchangeRateContract,
} from "./schemas/exchange-rates"
