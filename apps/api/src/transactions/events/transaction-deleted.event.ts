export class TransactionDeletedEvent {
  constructor(
    public readonly accountId: string,
    public readonly direction: "expense" | "income",
    public readonly amount: number
  ) {}
}
