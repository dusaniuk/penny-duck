export type DefaultCategoryType = "expense" | "income"

export interface DefaultCategoryGroup {
  name: string
  type: DefaultCategoryType
  color: string
  icon: string
  rank: number | null
  subtitle: string
  children: ReadonlyArray<{ name: string; icon: string }>
}

export const DEFAULT_CATEGORY_SET: ReadonlyArray<DefaultCategoryGroup> = [
  {
    name: "Income",
    type: "income",
    color: "emerald",
    icon: "cash",
    rank: null,
    subtitle: "money in",
    children: [
      { name: "Salary", icon: "building-bank" },
      { name: "Freelance", icon: "briefcase" },
      { name: "Other", icon: "coin" },
    ],
  },
  {
    name: "Essentials",
    type: "expense",
    color: "blue",
    icon: "home",
    rank: 1,
    subtitle: "must-pays",
    children: [
      { name: "Rent", icon: "home" },
      { name: "Utilities", icon: "bolt" },
      { name: "Internet", icon: "wifi" },
      { name: "Groceries", icon: "shopping-cart" },
      { name: "Taxes", icon: "receipt" },
      { name: "Insurance", icon: "shield" },
    ],
  },
  {
    name: "Lifestyle",
    type: "expense",
    color: "amber",
    icon: "shopping-bag",
    rank: 2,
    subtitle: "needed-but-flexible",
    children: [
      { name: "Clothes", icon: "shirt" },
      { name: "Home goods", icon: "sofa" },
      { name: "Car", icon: "car" },
      { name: "Gas", icon: "gas-station" },
      { name: "Health", icon: "heart" },
      { name: "Transport", icon: "bus" },
    ],
  },
  {
    name: "Treats",
    type: "expense",
    color: "pink",
    icon: "gift",
    rank: 3,
    subtitle: "guilty pleasures",
    children: [
      { name: "Restaurants", icon: "glass-full" },
      { name: "Coffee", icon: "coffee" },
      { name: "Food delivery", icon: "bowl-chopsticks" },
      { name: "Gifts", icon: "gift" },
      { name: "Events", icon: "confetti" },
      { name: "Subscriptions", icon: "movie" },
    ],
  },
]
