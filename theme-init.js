/* Aplica el tema antes de pintar para evitar parpadeos */
try {
  var s = (JSON.parse(localStorage.getItem("taskflow.v2")) || {}).settings || {};
  var dark = s.theme === "dark" || (s.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (s.accent) document.documentElement.dataset.accent = s.accent;
} catch (e) {
  if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark";
}
