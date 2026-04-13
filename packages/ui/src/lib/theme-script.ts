/**
 * Inline script to prevent flash of wrong theme on page load.
 * Injected as a blocking <script> in <head> before any rendering.
 */
export const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem("penny-duck-theme") || "system";
      var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (isDark) document.documentElement.classList.add("dark");
    } catch (e) {}
  })();
`
