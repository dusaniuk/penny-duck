import { useEffect, useState } from "react"

const BODY_EXAMPLE = `{
  "card": <Card>,
  "merchant": <Merchant>,
  "description": <Name>,
  "amount": <Amount as Number>,
  "currency": <Amount currency code>,
  "occurredAt": <Date, ISO 8601>
}`

export function ShortcutRecipe() {
  const [origin, setOrigin] = useState("")
  useEffect(() => setOrigin(window.location.origin), [])
  const url = `${origin}/api/inbox/wallet`

  return (
    <div className="space-y-4 text-base">
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Open the Shortcuts app, go to <strong>Automation</strong>, tap{" "}
          <strong>New Automation</strong>, choose <strong>Transaction</strong>.
        </li>
        <li>
          Select the cards to capture. Choose <strong>Run Immediately</strong>{" "}
          and turn off <strong>Notify When Run</strong>.
        </li>
        <li>
          Add a <strong>Dictionary</strong> action with these keys, filled from
          the Transaction input (all six, including the date):
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm">
            {BODY_EXAMPLE}
          </pre>
        </li>
        <li>
          Add <strong>Get Contents of URL</strong>: method <strong>POST</strong>
          , request body <strong>JSON</strong> from the dictionary, and a header{" "}
          <code className="rounded bg-muted px-1">x-api-key</code> with your
          key.
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-sm">
            {url}
          </pre>
        </li>
        <li>Tap a card once and check the Inbox.</li>
      </ol>
      <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Good to know</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Only Apple Pay taps on this phone are captured.</li>
          <li>
            Always include the Date field. Without it a retried tap is recorded
            twice.
          </li>
          <li>
            The trigger can fire for declined payments. Dismiss those in the
            Inbox.
          </li>
          <li>
            If the bank posts a tap late, iOS may skip it. Enter it by hand.
          </li>
          <li>
            Set a <strong>Wallet card name</strong> on each bank account so taps
            route themselves.
          </li>
        </ul>
      </div>
    </div>
  )
}
