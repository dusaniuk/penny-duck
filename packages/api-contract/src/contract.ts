import { initContract } from "@ts-rest/core"
import { authContract } from "./schemas/auth"
import { userContract } from "./schemas/users"
import { accountContract } from "./schemas/accounts"
import { categoryContract } from "./schemas/categories"
import { transactionContract } from "./schemas/transactions"
import { exchangeRateContract } from "./schemas/exchange-rates"

const c = initContract()

export const contract = c.router(
  {
    auth: authContract,
    users: userContract,
    accounts: accountContract,
    categories: categoryContract,
    transactions: transactionContract,
    exchangeRates: exchangeRateContract,
  },
  {
    pathPrefix: "",
  }
)
