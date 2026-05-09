(function () {
  const $endpoint = document.getElementById("endpoint");
  const $out = document.getElementById("out");
  const $save = document.getElementById("save");
  const $test = document.getElementById("test");

  const KEY = "exocracy.conscia.endpoint";

  function setOut(text) {
    $out.textContent = text;
  }

  function normalize(url) {
    return (url || "").trim().replace(/\/+$/, "");
  }

  function load() {
    const saved = localStorage.getItem(KEY) || "";
    $endpoint.value = saved;
    setOut(saved ? `Loaded endpoint: ${saved}` : "No endpoint saved yet.");
  }

  async function test() {
    const base = normalize($endpoint.value);
    if (!base) return setOut("Please enter an endpoint URL first.");
    setOut(`Testing: ${base}/health ...`);
    try {
      const res = await fetch(`${base}/health`, { method: "GET" });
      const text = await res.text();
      setOut(`HTTP ${res.status}\n\n${text}`);
    } catch (e) {
      setOut(`Connection failed:\n${String(e)}`);
    }
  }

  $save.addEventListener("click", () => {
    const base = normalize($endpoint.value);
    localStorage.setItem(KEY, base);
    setOut(base ? `Saved endpoint: ${base}` : "Cleared endpoint.");
  });

  $test.addEventListener("click", test);

  load();
})();

