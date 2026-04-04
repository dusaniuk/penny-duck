export class TokensRefreshedEvent {
  constructor(
    public readonly userId: string,
    public readonly familyId: string
  ) {}
}
