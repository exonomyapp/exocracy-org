(function () {
  const $did = document.getElementById("did");
  const $secret = document.getElementById("secret");
  const $saveIdentity = document.getElementById("saveIdentity");
  const $clearIdentity = document.getElementById("clearIdentity");
  const $identityHint = document.getElementById("identityHint");

  const $nodeName = document.getElementById("nodeName");
  const $nodeUrl = document.getElementById("nodeUrl");
  const $path = document.getElementById("path");
  const $out = document.getElementById("out");
  const $nodes = document.getElementById("nodes");
  const $addNode = document.getElementById("addNode");
  const $pollAll = document.getElementById("pollAll");
  const $test = document.getElementById("test");

  const $fetchDiscovery = document.getElementById("fetchDiscovery");
  const $fetchCapabilities = document.getElementById("fetchCapabilities");
  const $verifyCapability = document.getElementById("verifyCapability");
  const $roleRequested = document.getElementById("roleRequested");
  const $petition = document.getElementById("petition");
  const $searchQuery = document.getElementById("searchQuery");
  const $search = document.getElementById("search");

  const IDENTITY_KEY = "exocracy.identity.v1";
  const NODES_KEY = "exocracy.conscia.nodes";
  const SELECTED_KEY = "exocracy.conscia.selected";
  const PATH_KEY = "exocracy.conscia.path";
  const POLL_PATH = "/api/stats";

  /** in-memory runtime status cache (not persisted) */
  const statusByUrl = new Map();

  function setOut(text) {
    $out.textContent = text;
  }

  function setIdentityHint(text) {
    if ($identityHint) $identityHint.textContent = text;
  }

  function pretty(text) {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch (_) {
      return text;
    }
  }

  function normalize(url) {
    let v = (url || "").trim().replace(/\/+$/, "");
    if (!v) return v;
    // If the user pastes a bare host (e.g. "abcd.shares.zrok.io"), prepend a scheme.
    if (!v.includes("://")) {
      const lower = v.toLowerCase();
      const isLocal =
        lower.startsWith("localhost") ||
        lower.startsWith("127.0.0.1") ||
        lower.startsWith("[::1]");
      v = `${isLocal ? "http" : "https"}://${v}`;
    }
    return v;
  }

  function loadIdentity() {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { did: "", secret: "" };
    try {
      const parsed = JSON.parse(raw);
      return {
        did: typeof parsed.did === "string" ? parsed.did : "",
        secret: typeof parsed.secret === "string" ? parsed.secret : "",
      };
    } catch (_) {
      return { did: "", secret: "" };
    }
  }

  function saveIdentity(identity) {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  }

  function loadNodes() {
    const raw = localStorage.getItem(NODES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveNodes(nodes) {
    localStorage.setItem(NODES_KEY, JSON.stringify(nodes));
  }

  function getSelectedUrl() {
    return localStorage.getItem(SELECTED_KEY) || "";
  }

  function setSelectedUrl(url) {
    localStorage.setItem(SELECTED_KEY, url);
  }

  function render() {
    const nodes = loadNodes();
    const selected = getSelectedUrl();
    const savedPath = localStorage.getItem(PATH_KEY) || POLL_PATH;
    if ($path) $path.value = savedPath;

    if (!$nodes) return;
    $nodes.innerHTML = "";

    if (nodes.length === 0) {
      $nodes.innerHTML =
        '<div class="lede">No nodes saved yet. Add one above (example: <code>conscianikolasee</code> + its zrok URL).</div>';
      return;
    }

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "10px";

    for (const node of nodes) {
      const url = node.url;
      const st = statusByUrl.get(url);
      const card = document.createElement("div");
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "12px";
      card.style.padding = "12px";
      card.style.cursor = "pointer";
      card.style.background = url === selected ? "rgba(124,196,255,0.08)" : "transparent";

      const title = document.createElement("div");
      title.style.display = "flex";
      title.style.alignItems = "center";
      title.style.justifyContent = "space-between";

      const left = document.createElement("div");
      left.innerHTML = `<strong>${escapeHtml(node.name || "(unnamed)")}</strong><div class="lede" style="margin:6px 0 0;">${escapeHtml(url)}</div>`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";

      const pick = document.createElement("button");
      pick.className = "button secondary";
      pick.textContent = url === selected ? "Selected" : "Select";
      pick.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedUrl(url);
        render();
      });

      const del = document.createElement("button");
      del.className = "button secondary";
      del.textContent = "Remove";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = nodes.filter((n) => n.url !== url);
        saveNodes(next);
        if (getSelectedUrl() === url) setSelectedUrl(next[0]?.url || "");
        statusByUrl.delete(url);
        render();
      });

      right.appendChild(pick);
      right.appendChild(del);
      title.appendChild(left);
      title.appendChild(right);

      const meta = document.createElement("div");
      meta.className = "lede";
      meta.style.marginTop = "10px";
      if (!st) {
        meta.textContent = "Not polled yet.";
      } else if (st.error) {
        meta.textContent = `Error: ${st.error}`;
      } else {
        const { data } = st;
        const peers = st.peersCount != null ? st.peersCount : "—";
        meta.innerHTML =
          `Status: <strong>${escapeHtml(String(data.status || "—"))}</strong>` +
          ` • Version: <strong>${escapeHtml(String(data.version || "—"))}</strong>` +
          ` • Peers: <strong>${escapeHtml(String(peers))}</strong>`;
      }

      card.appendChild(title);
      card.appendChild(meta);
      card.addEventListener("click", () => {
        setSelectedUrl(url);
        render();
      });

      list.appendChild(card);
    }

    $nodes.appendChild(list);

    // Enable/disable engagement actions based on selection.
    const hasSelection = Boolean(selected);
    for (const btn of [$fetchDiscovery, $fetchCapabilities, $verifyCapability, $petition, $search]) {
      if (btn) btn.disabled = !hasSelection;
    }
  }

  async function request(url, path) {
    try {
      const identity = loadIdentity();
      const headers = new Headers();
      headers.set("Accept", "*/*");
      // "Real" scheme direction:
      // Use a proper Authorization scheme that can later carry signatures.
      // (CORS preflight still applies; Conscia should allow Authorization header.)
      const ts = Date.now();
      if (identity.did) {
        headers.set("Authorization", `ExoAuth did="${identity.did}", ts="${ts}"`);
      }

      const res = await fetch(`${url}${path}`, { method: "GET", headers });
      const text = await res.text();
      return { status: res.status, text };
    } catch (e) {
      return { status: 0, text: String(e) };
    }
  }

  async function requestJson(url, path, method, bodyObj) {
    try {
      const identity = loadIdentity();
      const headers = new Headers();
      headers.set("Accept", "application/json, text/plain, */*");
      headers.set("Content-Type", "application/json");
      const ts = Date.now();
      if (identity.did) {
        headers.set("Authorization", `ExoAuth did="${identity.did}", ts="${ts}"`);
      }
      const res = await fetch(`${url}${path}`, {
        method,
        headers,
        body: bodyObj ? JSON.stringify(bodyObj) : undefined,
      });
      const text = await res.text();
      return { status: res.status, text };
    } catch (e) {
      return { status: 0, text: String(e) };
    }
  }

  async function pollNode(url) {
    const stats = await request(url, POLL_PATH);
    if (stats.status !== 200) {
      statusByUrl.set(url, { error: `HTTP ${stats.status}: ${stats.text}` });
      return;
    }
    const data = (() => {
      try {
        return JSON.parse(stats.text);
      } catch (_) {
        return { raw: stats.text };
      }
    })();

    // Try peers (non-fatal if missing).
    let peersCount = null;
    const peers = await request(url, "/api/peers");
    if (peers.status === 200) {
      try {
        const parsed = JSON.parse(peers.text);
        // ExoSystems returns Vec<(String, Vec<String>)> which JSON-serializes as arrays.
        // We treat "top-level array length" as a coarse peer count.
        if (Array.isArray(parsed)) peersCount = parsed.length;
      } catch (_) {
        // ignore
      }
    }
    statusByUrl.set(url, { data, peersCount });
  }

  async function pollAll() {
    const nodes = loadNodes();
    if (nodes.length === 0) return setOut("No nodes saved yet.");
    setOut(`Polling ${nodes.length} node(s)...`);
    for (const node of nodes) {
      await pollNode(node.url);
      render();
    }
    setOut("Polling complete.");
  }

  async function testSelected() {
    const selected = getSelectedUrl();
    if (!selected) return setOut("No node selected. Click a node and choose Select.");
    const path = ($path && $path.value) || POLL_PATH;
    setOut(`Testing: ${selected}${path} ...`);
    const r = await request(selected, path);
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  async function fetchDiscovery() {
    const selected = getSelectedUrl();
    if (!selected) return setOut("No node selected.");
    setOut(`GET ${selected}/api/discovery ...`);
    const r = await request(selected, "/api/discovery");
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  async function fetchCapabilities() {
    const selected = getSelectedUrl();
    if (!selected) return setOut("No node selected.");
    setOut(`GET ${selected}/api/capabilities ...`);
    const r = await request(selected, "/api/capabilities");
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  async function verifyMyCapability() {
    const selected = getSelectedUrl();
    const identity = loadIdentity();
    if (!selected) return setOut("No node selected.");
    if (!identity.did) return setOut("Set your did:peer first (Identity section above).");
    setOut(`POST ${selected}/api/capabilities/verify ...`);
    const r = await requestJson(selected, "/api/capabilities/verify", "POST", { did: identity.did });
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  async function petitionRole() {
    const selected = getSelectedUrl();
    const identity = loadIdentity();
    if (!selected) return setOut("No node selected.");
    if (!identity.did) return setOut("Set your did:peer first (Identity section above).");
    const role = ($roleRequested?.value || "").trim() || "Read";
    setOut(`POST ${selected}/api/capabilities/petition (role=${role}) ...`);
    const r = await requestJson(selected, "/api/capabilities/petition", "POST", {
      did: identity.did,
      role_requested: role,
    });
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  async function searchMetadata() {
    const selected = getSelectedUrl();
    if (!selected) return setOut("No node selected.");
    const q = ($searchQuery?.value || "").trim();
    if (!q) return setOut("Enter a search query first.");
    const url = `${selected}/api/index/search?query=${encodeURIComponent(q)}`;
    setOut(`GET ${url} ...`);
    const r = await request(selected, `/api/index/search?query=${encodeURIComponent(q)}`);
    setOut(`HTTP ${r.status}\n\n${pretty(r.text)}`);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  $addNode.addEventListener("click", () => {
    const name = ($nodeName.value || "").trim();
    const url = normalize($nodeUrl.value || "");
    $nodeUrl.value = url;
    if (!name) return setOut("Please enter a node name (e.g., consciawarsaw).");
    if (!url) return setOut("Please enter a node URL.");
    const nodes = loadNodes();
    const next = [
      ...nodes.filter((n) => n.url !== url && n.name !== name),
      { name, url },
    ];
    saveNodes(next);
    setSelectedUrl(url);
    setOut(`Added node: ${name}\n${url}`);
    render();
  });

  $pollAll.addEventListener("click", pollAll);
  $test.addEventListener("click", testSelected);

  function initIdentityUi() {
    const identity = loadIdentity();
    if ($did) $did.value = identity.did || "";
    if ($secret) $secret.value = identity.secret || "";

    if (identity.did) {
      setIdentityHint("Saved. Requests will include your did:peer as a header.");
    } else {
      setIdentityHint("Not set yet. Paste your did:peer from your follower app when ready.");
    }

    $saveIdentity?.addEventListener("click", () => {
      const did = ($did?.value || "").trim();
      const secret = ($secret?.value || "").trim();
      saveIdentity({ did, secret });
      setIdentityHint(did ? "Saved. Requests will include your did:peer as a header." : "Cleared.");
    });

    $clearIdentity?.addEventListener("click", () => {
      saveIdentity({ did: "", secret: "" });
      if ($did) $did.value = "";
      if ($secret) $secret.value = "";
      setIdentityHint("Cleared.");
    });
  }

  // Persist path selection
  $path?.addEventListener("change", () => {
    localStorage.setItem(PATH_KEY, $path.value || POLL_PATH);
  });

  initIdentityUi();
  render();

  $fetchDiscovery?.addEventListener("click", fetchDiscovery);
  $fetchCapabilities?.addEventListener("click", fetchCapabilities);
  $verifyCapability?.addEventListener("click", verifyMyCapability);
  $petition?.addEventListener("click", petitionRole);
  $search?.addEventListener("click", searchMetadata);
})();
