import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@workspace/api-contract"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import {
  createCategory,
  deleteCategory,
  getCategoryUsage,
  listCategories,
  seedDefaultCategories,
  updateCategory,
} from "./service"

const IdParamSchema = z.object({ id: z.uuid() })

export const categoriesRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/", async (c) => {
    const user = c.get("user")
    const result = await listCategories(user.organizationId)
    return c.json(result)
  })
  .get("/usage", async (c) => {
    const user = c.get("user")
    const result = await getCategoryUsage(user.organizationId)
    return c.json(result)
  })
  .post("/seed", async (c) => {
    const user = c.get("user")
    const result = await seedDefaultCategories(user.organizationId)
    return c.json(result, 201)
  })
  .post("/", zValidator("json", CreateCategorySchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const category = await createCategory({
      organizationId: user.organizationId,
      name: body.name,
      parentId: body.parentId ?? null,
      icon: body.icon ?? null,
      type: body.type ?? "expense",
      color: body.color ?? null,
    })
    return c.json(category, 201)
  })
  .patch(
    "/:id",
    zValidator("param", IdParamSchema),
    zValidator("json", UpdateCategorySchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const category = await updateCategory({
        id,
        organizationId: user.organizationId,
        name: body.name,
        icon: body.icon,
        type: body.type,
        parentId: body.parentId,
        color: body.color,
      })
      return c.json(category)
    },
  )
  .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    await deleteCategory(id, user.organizationId)
    return c.json({ message: "Category deleted" })
  })
