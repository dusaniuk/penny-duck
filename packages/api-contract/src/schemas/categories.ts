import { initContract } from "@ts-rest/core"
import { z } from "zod"
import { MessageSchema } from "./common"

const c = initContract()

export const CategoryTypeSchema = z.enum(["expense", "income"])

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: CategoryTypeSchema,
  parentId: z.string().uuid().nullable(),
  icon: z.string().nullable(),
})

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: CategoryTypeSchema.optional(),
  parentId: z.string().uuid().optional(),
  icon: z.string().max(50).optional(),
})

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: CategoryTypeSchema.optional(),
  icon: z.string().max(50).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
})

export type CategoryType = z.infer<typeof CategoryTypeSchema>
export type Category = z.infer<typeof CategorySchema>

export const categoryContract = c.router({
  list: {
    method: "GET",
    path: "/categories",
    responses: {
      200: z.array(CategorySchema),
    },
  },
  create: {
    method: "POST",
    path: "/categories",
    body: CreateCategorySchema,
    responses: {
      201: CategorySchema,
    },
  },
  update: {
    method: "PATCH",
    path: "/categories/:id",
    body: UpdateCategorySchema,
    responses: {
      200: CategorySchema,
    },
  },
  delete: {
    method: "DELETE",
    path: "/categories/:id",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
})
