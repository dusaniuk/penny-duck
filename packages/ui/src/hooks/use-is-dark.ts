import * as React from "react"

// Returns whether the `dark` class is currently on documentElement (the
// resolved theme, accounting for "system" preference). Subscribes via
// MutationObserver so flips from the theme toggle re-render consumers.
export function useIsDark(): boolean {
  const [isDark, setIsDark] = React.useState<boolean>(false)

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setIsDark(root.classList.contains("dark"))
    read()
    const obs = new MutationObserver(read)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  return isDark
}
