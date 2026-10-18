import { describe, expect, it } from "vitest"
import { describeDevice, parseUserAgent } from "./user-agent"

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  firefoxLinux:
    "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
}

describe("parseUserAgent", () => {
  it("recognises desktop browsers", () => {
    expect(parseUserAgent(UA.chromeMac)).toEqual({
      browser: "Chrome",
      os: "macOS",
      mobile: false,
    })
    expect(parseUserAgent(UA.edgeWindows)).toMatchObject({
      browser: "Edge",
      os: "Windows",
    })
    expect(parseUserAgent(UA.firefoxLinux)).toMatchObject({
      browser: "Firefox",
      os: "Linux",
    })
  })

  it("recognises mobile browsers", () => {
    expect(parseUserAgent(UA.safariIphone)).toEqual({
      browser: "Safari",
      os: "iOS",
      mobile: true,
    })
    expect(parseUserAgent(UA.chromeIphone)).toMatchObject({
      browser: "Chrome",
      os: "iOS",
    })
    expect(parseUserAgent(UA.chromeAndroid)).toEqual({
      browser: "Chrome",
      os: "Android",
      mobile: true,
    })
  })

  it("handles missing or unknown agents", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: null,
      os: null,
      mobile: false,
    })
    expect(parseUserAgent("curl/8.7.1").browser).toBeNull()
  })
})

describe("describeDevice", () => {
  it("combines what is known", () => {
    expect(describeDevice(parseUserAgent(UA.chromeMac))).toBe("Chrome on macOS")
    expect(describeDevice({ browser: null, os: "Linux", mobile: false })).toBe(
      "Linux"
    )
    expect(describeDevice(parseUserAgent(null))).toBe("Unknown device")
  })
})
