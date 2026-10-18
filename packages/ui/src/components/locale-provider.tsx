import * as React from "react"

const LocaleContext = React.createContext<string | undefined>(undefined)

function LocaleProvider({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

function useLocale(): string | undefined {
  return React.useContext(LocaleContext)
}

export { LocaleProvider, useLocale }
