import { initContract } from "@ts-rest/core"
import { authContract } from "./schemas/auth"
import { accountContract } from "./schemas/accounts"
import { categoryContract } from "./schemas/categories"
import { transactionContract } from "./schemas/transactions"

const c = initContract()

export const contract = c.router(
  {
    auth: authContract,
    accounts: accountContract,
    categories: categoryContract,
    transactions: transactionContract,
  },
  {
    pathPrefix: "",
  }
)
