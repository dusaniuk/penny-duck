export class CategoryNotFoundError extends Error {
  constructor() {
    super("Category not found")
    this.name = "CategoryNotFoundError"
  }
}

export class MaxCategoryDepthError extends Error {
  constructor() {
    super("Subcategories cannot have children")
    this.name = "MaxCategoryDepthError"
  }
}

export class ParentCategoryNotFoundError extends Error {
  constructor() {
    super("Parent category not found")
    this.name = "ParentCategoryNotFoundError"
  }
}
