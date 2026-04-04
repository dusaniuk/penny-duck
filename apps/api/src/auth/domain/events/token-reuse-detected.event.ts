export class TokenReuseDetectedEvent {
  constructor(
    public readonly userId: string,
    public readonly familyId: string
  ) {}
}
