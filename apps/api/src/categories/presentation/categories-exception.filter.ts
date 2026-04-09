import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import {
  CategoryNotFoundError,
  MaxCategoryDepthError,
  ParentCategoryNotFoundError,
} from "../errors/category.errors"

type CategoryError =
  | CategoryNotFoundError
  | MaxCategoryDepthError
  | ParentCategoryNotFoundError

@Catch(
  CategoryNotFoundError,
  MaxCategoryDepthError,
  ParentCategoryNotFoundError
)
export class CategoriesExceptionFilter implements ExceptionFilter<CategoryError> {
  catch(exception: CategoryError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    if (exception instanceof CategoryNotFoundError) {
      response.status(404).json({ message: exception.message })
      return
    }
    response.status(400).json({ message: exception.message })
  }
}
