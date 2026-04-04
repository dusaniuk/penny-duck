interface CategoryData {
  id: string
  userId: string
  parentId: string | null
  name: string
  icon: string | null
  createdAt: Date
  updatedAt: Date
}

export class Category {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _parentId: string | null,
    private _name: string,
    private _icon: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(
    userId: string,
    name: string,
    parentId: string | null,
    icon: string | null
  ): Category {
    if (name.trim().length === 0)
      throw new Error("Category name cannot be empty")
    return new Category(
      "",
      userId,
      parentId,
      name.trim(),
      icon,
      new Date(),
      new Date()
    )
  }

  static fromPersistence(data: CategoryData): Category {
    return new Category(
      data.id,
      data.userId,
      data.parentId,
      data.name,
      data.icon,
      data.createdAt,
      data.updatedAt
    )
  }

  updateName(name: string): void {
    if (name.trim().length === 0)
      throw new Error("Category name cannot be empty")
    this._name = name.trim()
    this._updatedAt = new Date()
  }

  updateIcon(icon: string | null): void {
    this._icon = icon
    this._updatedAt = new Date()
  }

  get id(): string {
    return this._id
  }
  get userId(): string {
    return this._userId
  }
  get parentId(): string | null {
    return this._parentId
  }
  get name(): string {
    return this._name
  }
  get icon(): string | null {
    return this._icon
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
