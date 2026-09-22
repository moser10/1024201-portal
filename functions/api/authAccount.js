export function parseUsername(name, { min = 6 } = {}) {
  const username = String(name || "").trim();
  if (!username) return { error: "empty_name" };
  if (username.length < min) return { error: "short_name" };
  if (username.length > 24) return { error: "long_name" };
  return { username };
}

export function parseNewEmail(email, current) {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: "bad_email" };
  if (current && mail === String(current).trim().toLowerCase()) return { error: "same_email" };
  return { email: mail };
}

export function parsePasswordPair(password, password2, { min = 6 } = {}) {
  const a = String(password || "");
  const b = String(password2 || "");
  if (a.length < min) return { error: "short_pass" };
  if (a !== b) return { error: "pass_mismatch" };
  return { password: a };
}
