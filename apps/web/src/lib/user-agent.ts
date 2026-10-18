export interface DeviceInfo {
  browser: string | null
  os: string | null
  mobile: boolean
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
]

const OPERATING_SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPod/, "iOS"],
  [/iPad/, "iPadOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
]

function match(ua: string, table: Array<[RegExp, string]>): string | null {
  return table.find(([re]) => re.test(ua))?.[1] ?? null
}

export function parseUserAgent(ua: string | null): DeviceInfo {
  if (!ua) return { browser: null, os: null, mobile: false }
  return {
    browser: match(ua, BROWSERS),
    os: match(ua, OPERATING_SYSTEMS),
    mobile: /Mobi|iPhone|iPad|iPod|Android/.test(ua),
  }
}

export function describeDevice({ browser, os }: DeviceInfo): string {
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? "Unknown device"
}
