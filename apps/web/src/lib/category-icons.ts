import {
  IconApple,
  IconBabyCarriage,
  IconBallTennis,
  IconBath,
  IconBeer,
  IconBike,
  IconBolt,
  IconBook,
  IconBottle,
  IconBriefcase,
  IconBuildingBank,
  IconBulb,
  IconBus,
  IconCar,
  IconCash,
  IconChartLine,
  IconCoffee,
  IconCoin,
  IconCookie,
  IconCreditCard,
  IconDeviceGamepad,
  IconDroplet,
  IconEgg,
  IconFish,
  IconFlame,
  IconGasStation,
  IconGift,
  IconHanger,
  IconHeadphones,
  IconHeartbeat,
  IconHome,
  IconMail,
  IconMeat,
  IconMilk,
  IconMovie,
  IconMusic,
  IconParking,
  IconPaw,
  IconPhone,
  IconPigMoney,
  IconPill,
  IconPizza,
  IconPlane,
  IconReceipt,
  IconReceipt2,
  IconSalad,
  IconSchool,
  IconShirt,
  IconShoppingBag,
  IconShoppingCart,
  IconSofa,
  IconSoup,
  IconTag,
  IconTicket,
  IconTool,
  IconVaccineBottle,
  IconWalk,
  IconWorld,
} from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

export interface CategoryIcon {
  name: string
  label: string
  component: Icon
  group: string
}

export const CATEGORY_ICONS: Array<CategoryIcon> = [
  // Food
  { name: "meat", label: "Meat", component: IconMeat, group: "Food" },
  { name: "soup", label: "Soup", component: IconSoup, group: "Food" },
  { name: "coffee", label: "Coffee", component: IconCoffee, group: "Food" },
  { name: "beer", label: "Beer", component: IconBeer, group: "Food" },
  { name: "pizza", label: "Pizza", component: IconPizza, group: "Food" },
  { name: "apple", label: "Apple", component: IconApple, group: "Food" },
  { name: "fish", label: "Fish", component: IconFish, group: "Food" },
  { name: "egg", label: "Egg", component: IconEgg, group: "Food" },
  { name: "milk", label: "Milk", component: IconMilk, group: "Food" },
  { name: "cookie", label: "Cookie", component: IconCookie, group: "Food" },
  { name: "salad", label: "Salad", component: IconSalad, group: "Food" },
  { name: "bottle", label: "Bottle", component: IconBottle, group: "Food" },

  // Transport
  { name: "car", label: "Car", component: IconCar, group: "Transport" },
  { name: "bus", label: "Bus", component: IconBus, group: "Transport" },
  { name: "bike", label: "Bike", component: IconBike, group: "Transport" },
  { name: "plane", label: "Plane", component: IconPlane, group: "Transport" },
  { name: "walk", label: "Walk", component: IconWalk, group: "Transport" },
  {
    name: "gas-station",
    label: "Gas Station",
    component: IconGasStation,
    group: "Transport",
  },
  {
    name: "parking",
    label: "Parking",
    component: IconParking,
    group: "Transport",
  },

  // Home
  { name: "home", label: "Home", component: IconHome, group: "Home" },
  { name: "tool", label: "Tools", component: IconTool, group: "Home" },
  { name: "bolt", label: "Electricity", component: IconBolt, group: "Home" },
  { name: "flame", label: "Heating", component: IconFlame, group: "Home" },
  { name: "droplet", label: "Water", component: IconDroplet, group: "Home" },
  { name: "bulb", label: "Light", component: IconBulb, group: "Home" },
  { name: "sofa", label: "Furniture", component: IconSofa, group: "Home" },
  { name: "bath", label: "Bath", component: IconBath, group: "Home" },

  // Health
  {
    name: "heartbeat",
    label: "Health",
    component: IconHeartbeat,
    group: "Health",
  },
  { name: "pill", label: "Medicine", component: IconPill, group: "Health" },
  {
    name: "vaccine-bottle",
    label: "Vaccine",
    component: IconVaccineBottle,
    group: "Health",
  },

  // Shopping
  {
    name: "shopping-cart",
    label: "Shopping Cart",
    component: IconShoppingCart,
    group: "Shopping",
  },
  {
    name: "shopping-bag",
    label: "Shopping Bag",
    component: IconShoppingBag,
    group: "Shopping",
  },
  {
    name: "receipt",
    label: "Receipt",
    component: IconReceipt,
    group: "Shopping",
  },
  { name: "tag", label: "Tag", component: IconTag, group: "Shopping" },
  { name: "gift", label: "Gift", component: IconGift, group: "Shopping" },
  {
    name: "shirt",
    label: "Clothing",
    component: IconShirt,
    group: "Shopping",
  },
  {
    name: "hanger",
    label: "Hanger",
    component: IconHanger,
    group: "Shopping",
  },

  // Entertainment
  {
    name: "movie",
    label: "Movie",
    component: IconMovie,
    group: "Entertainment",
  },
  {
    name: "music",
    label: "Music",
    component: IconMusic,
    group: "Entertainment",
  },
  {
    name: "headphones",
    label: "Headphones",
    component: IconHeadphones,
    group: "Entertainment",
  },
  {
    name: "device-gamepad",
    label: "Gaming",
    component: IconDeviceGamepad,
    group: "Entertainment",
  },
  {
    name: "ticket",
    label: "Ticket",
    component: IconTicket,
    group: "Entertainment",
  },
  {
    name: "ball-tennis",
    label: "Sports",
    component: IconBallTennis,
    group: "Entertainment",
  },

  // Finance
  { name: "cash", label: "Cash", component: IconCash, group: "Finance" },
  {
    name: "credit-card",
    label: "Credit Card",
    component: IconCreditCard,
    group: "Finance",
  },
  { name: "coin", label: "Coin", component: IconCoin, group: "Finance" },
  {
    name: "building-bank",
    label: "Bank",
    component: IconBuildingBank,
    group: "Finance",
  },
  {
    name: "chart-line",
    label: "Chart",
    component: IconChartLine,
    group: "Finance",
  },
  {
    name: "receipt-2",
    label: "Invoice",
    component: IconReceipt2,
    group: "Finance",
  },
  {
    name: "pig-money",
    label: "Savings",
    component: IconPigMoney,
    group: "Finance",
  },

  // Misc
  { name: "book", label: "Education", component: IconBook, group: "Misc" },
  { name: "briefcase", label: "Work", component: IconBriefcase, group: "Misc" },
  { name: "phone", label: "Phone", component: IconPhone, group: "Misc" },
  { name: "mail", label: "Mail", component: IconMail, group: "Misc" },
  { name: "world", label: "Travel", component: IconWorld, group: "Misc" },
  { name: "paw", label: "Pets", component: IconPaw, group: "Misc" },
  {
    name: "baby-carriage",
    label: "Kids",
    component: IconBabyCarriage,
    group: "Misc",
  },
  { name: "school", label: "School", component: IconSchool, group: "Misc" },
]

const iconMap = new Map(CATEGORY_ICONS.map((i) => [i.name, i]))

export function getCategoryIcon(iconName: string | null): CategoryIcon | null {
  if (!iconName) return null
  return iconMap.get(iconName) ?? null
}
