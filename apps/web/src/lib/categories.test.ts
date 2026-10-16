import { describe, expect, it } from "vitest"
import {
  activeCategories,
  isArchivedCategory,
  pickableCategories,
  pickerGroups,
} from "./categories"
import type { Category } from "@workspace/api-contract"

const ARCHIVED = "2026-10-01T00:00:00.000Z"

function cat(over: Partial<Category>): Category {
  return {
    id: crypto.randomUUID(),
    name: "Cat",
    type: "expense",
    parentId: null,
    icon: null,
    color: "red",
    archivedAt: null,
    ...over,
  }
}

const food = cat({ name: "Food" })
const trips = cat({ name: "Trips", archivedAt: ARCHIVED })
const warsaw = cat({
  name: "Warsaw 2026",
  parentId: trips.id,
  color: null,
  archivedAt: ARCHIVED,
})
const travel = cat({ name: "Travel" })
const oldTrip = cat({
  name: "Lisbon 2024",
  parentId: travel.id,
  color: null,
  archivedAt: ARCHIVED,
})
const all = [food, trips, warsaw, travel, oldTrip]

describe("category helpers — archived filtering", () => {
  it("isArchivedCategory is true only when archivedAt is set", () => {
    expect(isArchivedCategory(food)).toBe(false)
    expect(isArchivedCategory(trips)).toBe(true)
  })

  it("activeCategories drops archived parents and children", () => {
    expect(activeCategories(all).map((c) => c.name)).toEqual(["Food", "Travel"])
  })

  it("pickableCategories is the active set when nothing archived is selected", () => {
    expect(pickableCategories(all, null).map((c) => c.name)).toEqual([
      "Food",
      "Travel",
    ])
    expect(pickableCategories(all, food.id).map((c) => c.name)).toEqual([
      "Food",
      "Travel",
    ])
  })

  it("pickableCategories keeps an archived selected child and its archived parent", () => {
    expect(pickableCategories(all, warsaw.id).map((c) => c.name)).toEqual([
      "Food",
      "Trips",
      "Warsaw 2026",
      "Travel",
    ])
  })

  it("pickableCategories keeps an archived selected child under an active parent", () => {
    expect(pickableCategories(all, oldTrip.id).map((c) => c.name)).toEqual([
      "Food",
      "Travel",
      "Lisbon 2024",
    ])
  })
})

describe("pickerGroups", () => {
  const empty = cat({ name: "Empty parent" })
  const foodParent = cat({ name: "Food" })
  const groceries = cat({
    name: "Groceries",
    parentId: foodParent.id,
    color: null,
  })
  const dining = cat({ name: "Dining", parentId: foodParent.id, color: null })
  const list = [empty, foodParent, groceries, dining]

  it("skips a parent that has no children in the list", () => {
    const groups = pickerGroups(list, "")
    expect(groups.map((g) => g.parent.name)).toEqual(["Food"])
    expect(groups[0].children.map((c) => c.name)).toEqual([
      "Groceries",
      "Dining",
    ])
  })

  it("skips a parent whose only children were filtered out upstream", () => {
    const groups = pickerGroups(
      pickableCategories([...list, oldTrip, travel], null),
      ""
    )
    expect(groups.map((g) => g.parent.name)).toEqual(["Food"])
  })

  it("filters children by the query and drops parents with no match", () => {
    const groups = pickerGroups(list, "din")
    expect(groups).toHaveLength(1)
    expect(groups[0].children.map((c) => c.name)).toEqual(["Dining"])
    expect(pickerGroups(list, "food")).toEqual([])
  })
})
