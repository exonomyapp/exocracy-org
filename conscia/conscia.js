(function () {
  const $endpoint = document.getElementById("endpoint");
  const $path = document.getElementById("path");
  const $out = document.getElementById("out");
  const $save = document.getElementById("save");
  const $test = document.getElementById("test");

  const KEY = "exocracy.conscia.endpoint";
  const PATH_KEY = "exocracy.conscia.path";

  function setOut(text) {
    $out.textContent = text;
  }

  function normalize(url) {
    return (url || "").trim().replace(/\/+$/, "");
  }

  function load() {
    const saved = localStorage.getItem(KEY) || "";
    $endpoint.value = saved;
    const savedPath = localStorage.getItem(PATH_KEY) || "/api/stats";
    if ($path) $path.value = savedPath;
    setOut(
      saved
        ? `Loaded endpoint: ${saved}\nTest path: ${savedPath}`
        : "No endpoint saved yet."
    );
  }

  async function test() {
    const base = normalize($endpoint.value);
    if (!base) return setOut("Please enter an endpoint URL first.");
    const path = ($path && $path.value) || "/api/stats";
    setOut(`Testing: ${base}${path} ...`);
    try {
      const res = await fetch(`${base}${path}`, { method: "GET" });
      const text = await res.text();
      setOut(`HTTP ${res.status}\n\n${text}`);
    } catch (e) {
      setOut(`Connection failed:\n${String(e)}`);
    }
  }

  $save.addEventListener("click", () => {
    const base = normalize($endpoint.value);
    localStorage.setItem(KEY, base);
    const path = ($path && $path.value) || "/api/stats";
    localStorage.setItem(PATH_KEY, path);
    setOut(
      base
        ? `Saved endpoint: ${base}\nTest path: ${path}`
        : "Cleared endpoint."
    );
  });

  $test.addEventListener("click", test);

  load();
})();
