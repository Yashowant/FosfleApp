(function () {
  const params = new URLSearchParams(window.location.search);
  const initialTheme = params.get("theme") || localStorage.getItem("fosfle_theme_v2") || "light";
  const lessonId = params.get("lessonId") || "";
  const mode = params.get("mode") || "lesson";

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
    document.documentElement.setAttribute("data-bs-theme", t === "dark" ? "dark" : "light");
  }
  applyTheme(initialTheme);

  window.addEventListener("message", (ev) => {
    if (ev.data?.type === "fosfle-theme") {
      applyTheme(ev.data.theme);
    }
  });

  // Auto-detect quiz or challenge completion and report to parent Android app
  if (mode === "quiz" || mode === "challenge") {
    const observer = new MutationObserver(() => {
      const resultScreen = document.getElementById("result-screen") || document.getElementById("success-screen");
      if (resultScreen && resultScreen.classList.contains("active")) {
        window.parent?.postMessage({ type: "fosfle-complete", lessonId, mode }, "*");
      }
    });
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
    });
  }
})();
