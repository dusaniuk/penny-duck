import { useEffect, useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type { Instrument } from "@workspace/api-contract"
import { tsr } from "@/lib/api"

interface Props {
  value: string
  onChange: (symbol: string, instrument: Instrument) => void
  disabled?: boolean
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])
  return debounced
}

export function InstrumentAutocomplete({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const debounced = useDebouncedValue(query, 250)

  const { data, isFetching } = tsr.investments.searchInstruments.useQuery({
    queryKey: ["instruments", "search", debounced],
    queryData: { query: { q: debounced } },
    enabled: debounced.length > 0,
  })
  const results = data?.body ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || "Select symbol"}
          <IconChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search AAPL, MSFT…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching
                ? "Searching…"
                : query.length === 0
                  ? "Type to search"
                  : "No results"}
            </CommandEmpty>
            <CommandGroup>
              {results.map((instrument) => (
                <CommandItem
                  key={instrument.symbol}
                  value={instrument.symbol}
                  onSelect={() => {
                    onChange(instrument.symbol, instrument)
                    setOpen(false)
                  }}
                >
                  <span className="font-medium">{instrument.symbol}</span>
                  <span className="ml-2 truncate text-muted-foreground">
                    {instrument.name}
                  </span>
                  {instrument.exchange && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {instrument.exchange}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
