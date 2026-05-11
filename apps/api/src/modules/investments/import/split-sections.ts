// apps/api/src/investments/import/split-sections.ts
import { parse } from "csv-parse/sync"

export interface RawSection {
  header: string[]
  rows: Array<Record<string, string>>
  headerLine: number
  rowLines: number[]
}

/**
 * Splits an IBKR multi-section CSV into one RawSection per occurrence of a
 * "ClientAccountID" header row. Throws if no such header is found.
 */
export function splitSections(csv: string): RawSection[] {
  const rows = parse(csv, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][]

  if (rows.length === 0 || rows[0][0] !== "ClientAccountID") {
    throw new Error('Expected first row to start with "ClientAccountID" header')
  }

  const sections: RawSection[] = []
  let currentHeader: string[] | null = null
  let currentHeaderLine = 0
  let currentRows: Record<string, string>[] = []
  let currentRowLines: number[] = []

  rows.forEach((row, idx) => {
    const lineNumber = idx + 1
    if (row[0] === "ClientAccountID") {
      if (currentHeader) {
        sections.push({
          header: currentHeader,
          rows: currentRows,
          headerLine: currentHeaderLine,
          rowLines: currentRowLines,
        })
      }
      currentHeader = row
      currentHeaderLine = lineNumber
      currentRows = []
      currentRowLines = []
      return
    }
    if (!currentHeader) return
    const record: Record<string, string> = {}
    currentHeader.forEach((col, i) => {
      record[col] = row[i] ?? ""
    })
    currentRows.push(record)
    currentRowLines.push(lineNumber)
  })

  if (currentHeader) {
    sections.push({
      header: currentHeader,
      rows: currentRows,
      headerLine: currentHeaderLine,
      rowLines: currentRowLines,
    })
  }

  return sections
}
