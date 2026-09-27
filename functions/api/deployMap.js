export const KEEP_BRANCHES = new Set(["main", "production"]);

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

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "1024201-portal-admin",
    },
  });
  if (!res.ok) throw new Error(`github_${res.status}`);
  return res.json();
}

export async function buildDeployMap({ recorded, deployments }) {
  const pair = pickDeployPair(deployments);
  const currentBranch = recorded?.branch || "cursor/cloud-agent-1783569938677-9euo1";
  const currentVersion = recorded?.versionId || pair.current?.versionId || "";
  const previousVersion = recorded?.previousVersionId || pair.previous?.versionId || "";

  const branches = await gh("/repos/moser10/1024201-portal/branches?per_page=100");
  const now = Date.now();
  const items = [];
  for (const b of branches) {
    const name = b.name;
    let updatedAt = "";
    let compareStatus = "diverged";
    try {
      const [detail, cmp] = await Promise.all([
        gh(`/repos/moser10/1024201-portal/branches/${encodeURIComponent(name)}`),
        name === currentBranch
          ? Promise.resolve({ status: "identical" })
          : gh(`/repos/moser10/1024201-portal/compare/${encodeURIComponent(currentBranch)}...${encodeURIComponent(name)}`),
      ]);
      updatedAt = detail?.commit?.commit?.committer?.date || detail?.commit?.commit?.author?.date || "";
      compareStatus = cmp?.status || "diverged";
    } catch {
      compareStatus = "unknown";
    }
    items.push({
      name,
      sha: (b.commit?.sha || "").slice(0, 7),
      updatedAt,
      hot: isHot(updatedAt, now),
      color: classifyBranch({ name, compareStatus, currentBranch }),
      compareStatus,
    });
  }

  items.sort((a, b) => {
    const rank = { green: 0, blue: 1, red: 2 };
    return (rank[a.color] ?? 9) - (rank[b.color] ?? 9) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  return {
    currentVersion,
    previousVersion,
    currentBranch,
    recordedAt: recorded?.at || pair.current?.createdOn || "",
    branches: items,
  };
}
