import { z } from "zod"

export const CategoryTypeSchema = z.enum(["expense", "income"])

export const CategoryColorSchema = z.string().trim().min(1).max(20)

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: CategoryTypeSchema,
  parentId: z.string().uuid().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
})

export const CreateCategorySchema = z
  .object({
    name: z.string().min(1).max(100),
    type: CategoryTypeSchema.optional(),
    parentId: z.string().uuid().optional(),
    icon: z.string().max(50).optional(),
    color: CategoryColorSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const isChild = data.parentId !== undefined
    if (isChild && data.color !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["color"],
        message: "Subcategories cannot have a color",
      })
    }
    if (!isChild && data.color === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["color"],
        message: "Top-level categories require a color",
      })
    }
  })

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: CategoryTypeSchema.optional(),
  icon: z.string().max(50).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: CategoryColorSchema.optional(),
})

export type CategoryType = z.infer<typeof CategoryTypeSchema>
export type CategoryColor = z.infer<typeof CategoryColorSchema>
export type Category = z.infer<typeof CategorySchema>
