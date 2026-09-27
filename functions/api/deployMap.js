export const KEEP_BRANCHES = new Set(["main", "production"]);
export const DEFAULT_REPO = "moser10/1024201-portal";

export function isHot(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) && now - t < 24 * 60 * 60 * 1000;
}

/** green = live, red = safe to delete, blue = keep/other */
export function classifyBranch({ name, compareStatus, currentBranch }) {
  if (name === currentBranch) return "green";
  if (KEEP_BRANCHES.has(name)) return "blue";
  if (compareStatus === "behind" || compareStatus === "identical") return "red";
  return "blue";
}

export function pickDeployPair(deployments) {
  const rows = [...(deployments || [])].sort((a, b) => String(a.created_on).localeCompare(String(b.created_on)));
  const last = rows.at(-1) || null;
  const prev = rows.at(-2) || null;
  const ver = (row) => row?.versions?.[0]?.version_id || row?.version_id || "";
  return {
    current: last ? { versionId: ver(last), createdOn: last.created_on, source: last.source || "" } : null,
    previous: prev ? { versionId: ver(prev), createdOn: prev.created_on, source: prev.source || "" } : null,
  };
}

export function paintBranchItems(rows, currentBranch, now = Date.now()) {
  return (rows || []).map((r) => ({
    name: r.name,
    sha: String(r.sha || "").slice(0, 7),
    updatedAt: r.updatedAt || "",
    summary: String(r.summary || "").trim(),
    hot: isHot(r.updatedAt, now),
    color: classifyBranch({ name: r.name, compareStatus: r.compareStatus || "unknown", currentBranch }),
    compareStatus: r.compareStatus || "unknown",
  }));
}

export function layoutVersionTree({ branches = [], currentVersion = "", previousVersion = "", currentBranch = "" }) {
  const items = [...branches];
  const trunk = items.find((b) => b.name === "main") || items.find((b) => b.name === currentBranch) || items[0] || null;
  const limbs = items.filter((b) => b && b !== trunk);
  return {
    worker: {
      current: { id: currentVersion, branch: currentBranch },
      previous: { id: previousVersion },
    },
    trunk,
    limbs,
  };
}

export function fallbackBranchRows(recorded) {
  const currentBranch = recorded?.branch || "main";
  const rows = [
    {
      name: currentBranch,
      sha: recorded?.sha || "",
      updatedAt: recorded?.at || "",
      compareStatus: "identical",
      summary: recorded?.summary || "",
    },
  ];
  if (currentBranch !== "main") {
    rows.push({ name: "main", sha: "", updatedAt: "", compareStatus: "unknown", summary: "门户主干" });
  }
  return rows;
}

export function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "1024201-portal-admin",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gh(path, token) {
  const res = await fetch(`https://api.github.com${path}`, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(`github_${res.status}`);
  return res.json();
}

export async function fetchGithubBranchRows({ token, repo = DEFAULT_REPO, currentBranch }) {
  if (!token) throw new Error("github_no_token");
  const branches = await gh(`/repos/${repo}/branches?per_page=100`, token);
  const rows = [];
  for (const b of branches) {
    const name = b.name;
    let updatedAt = "";
    let compareStatus = "diverged";
    let sha = (b.commit?.sha || "").slice(0, 7);
    try {
      const [detail, cmp] = await Promise.all([
        gh(`/repos/${repo}/branches/${encodeURIComponent(name)}`, token),
        name === currentBranch
          ? Promise.resolve({ status: "identical" })
          : gh(`/repos/${repo}/compare/${encodeURIComponent(currentBranch)}...${encodeURIComponent(name)}`, token),
      ]);
      updatedAt = detail?.commit?.commit?.committer?.date || detail?.commit?.commit?.author?.date || "";
      compareStatus = cmp?.status || "diverged";
      sha = (detail?.commit?.sha || b.commit?.sha || "").slice(0, 7);
    } catch {
      compareStatus = "unknown";
    }
    rows.push({ name, sha, updatedAt, compareStatus, summary: "" });
  }
  return rows;
}

export async function buildDeployMap({ recorded, deployments, githubToken, snapshot, repo = DEFAULT_REPO }) {
  const pair = pickDeployPair(deployments);
  const currentBranch = recorded?.branch || snapshot?.currentBranch || "main";
  const currentVersion = recorded?.versionId || pair.current?.versionId || "";
  const previousVersion = recorded?.previousVersionId || pair.previous?.versionId || "";
  const now = Date.now();

  let rows = [];
  let source = "fallback";
  let githubError = "";

  if (githubToken) {
    try {
      rows = await fetchGithubBranchRows({ token: githubToken, repo, currentBranch });
      source = "github";
    } catch (e) {
      githubError = e.message || "github_failed";
    }
  }

  if (!rows.length && snapshot?.branches?.length) {
    rows = snapshot.branches;
    source = snapshot.source || "snapshot";
  }

  if (!rows.length) {
    rows = fallbackBranchRows(recorded);
    source = "fallback";
  }

  const items = paintBranchItems(rows, currentBranch, now);
  items.sort((a, b) => {
    const rank = { green: 0, blue: 1, red: 2 };
    return (rank[a.color] ?? 9) - (rank[b.color] ?? 9) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  return {
    currentVersion,
    previousVersion,
    currentBranch,
    recordedAt: recorded?.at || pair.current?.createdOn || "",
    source,
    githubError,
    branches: items,
    tree: layoutVersionTree({ branches: items, currentVersion, previousVersion, currentBranch }),
  };
}
