import { customType } from "drizzle-orm/pg-core"

export const money = customType<{ data: number; driverValue: number }>({
  dataType() {
    return "integer"
  },
  fromDriver(value) {
    return (value as number) / 100
  },
  toDriver(value: number) {
    return Math.round(value * 100)
  },
})

export const rate = customType<{ data: number; driverValue: number }>({
  dataType() {
    return "integer"
  },
  fromDriver(value) {
    return (value as number) / 1_000_000
  },
  toDriver(value: number) {
    return Math.round(value * 1_000_000)
  },
})
