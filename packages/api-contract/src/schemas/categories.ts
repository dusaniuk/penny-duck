import { z } from "zod"

export const CategoryTypeSchema = z.enum(["expense", "income"])

export const CategoryColorSchema = z.string().trim().min(1).max(20)

export const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: CategoryTypeSchema,
  parentId: z.uuid().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
})

export const CreateCategorySchema = z
  .object({
    name: z.string().min(1).max(100),
    type: CategoryTypeSchema.optional(),
    parentId: z.uuid().optional(),
    icon: z.string().max(50).optional(),
    color: CategoryColorSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const isChild = data.parentId !== undefined
    if (isChild && data.color !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["color"],
        message: "Subcategories cannot have a color",
      })
    }
    if (!isChild && data.color === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["color"],
        message: "Top-level categories require a color",
      })
    }
  })

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: CategoryTypeSchema.optional(),
  icon: z.string().max(50).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  color: CategoryColorSchema.optional(),
})

export const CategoryUsageItemSchema = z.object({
  categoryId: z.uuid(),
  // All-time count of categorized transactions. Drives the transaction-form
  // "most used" grid and the delete-dialog "N transactions" warning.
  count: z.number().int().nonnegative(),
  // Current-month cash-flow stats (excludes reimbursement legs and brokerage
  // accounts). Drive the categories page banner, stats strip, and cards.
  countThisMonth: z.number().int().nonnegative(),
  spentThisMonth: z.number().nonnegative(),
  lastActivityAt: z.string().nullable(),
})

export const CategoryUsageResponseSchema = z.array(CategoryUsageItemSchema)

export type CategoryType = z.infer<typeof CategoryTypeSchema>
export type CategoryColor = z.infer<typeof CategoryColorSchema>
export type Category = z.infer<typeof CategorySchema>
export type CategoryUsageItem = z.infer<typeof CategoryUsageItemSchema>
