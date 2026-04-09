export class TransactionCreatedEvent {
  constructor(
    public readonly accountId: string,
    public readonly direction: "expense" | "income",
    public readonly amount: number
  ) {}
}
