const SALT = "osn-game-v1";

export async function hashPassword(password) {
  const data = new TextEncoder().encode(`${password}${SALT}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return (await hashPassword(password)) === hash;
}

export function randomPassword(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function randomVerifyCode(len = 4) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** CLI 注册：6 位纯数字，排除豹子号、顺子、重复模式、常见吉利号 */
export function isForbiddenCliVerifyCode(code) {
  if (!/^\d{6}$/.test(code)) return true;

  if (/^(\d)\1{5}$/.test(code)) return true;

  let asc = true;
  let desc = true;
  for (let i = 0; i < 5; i++) {
    const a = Number(code[i]);
    const b = Number(code[i + 1]);
    if (b !== a + 1) asc = false;
    if (b !== a - 1) desc = false;
  }
  if (asc || desc) return true;

  if (code.slice(0, 2) === code.slice(2, 4) && code.slice(0, 2) === code.slice(4, 6)) return true;
  if (code.slice(0, 3) === code.slice(3, 6)) return true;
  if (code[0] === code[1] && code[2] === code[3] && code[4] === code[5] && code[0] !== code[2]) return true;

  const block = new Set([
    "012345", "123456", "234567", "345678", "456789", "567890",
    "098765", "987654", "876543", "765432", "654321", "543210",
    "121212", "123123", "112233", "223344", "334455", "445566", "556677", "667788", "778899",
    "168168", "520520", "520131", "131452", "886688", "168888", "666888", "999666",
  ]);
  return block.has(code);
}

export function randomCliVerifyCode() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = String(n).padStart(6, "0");
    if (!isForbiddenCliVerifyCode(code)) return code;
  }
  throw new Error("无法生成 CLI 注册码");
}
