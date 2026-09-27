export const FT_BASE_BYTES = 20 * 1024 * 1024;

export function ftLimitFromExtraMb(extraMb) {
  const extra = Math.max(0, Number(extraMb) || 0);
  return FT_BASE_BYTES + extra * 1024 * 1024;
}

export async function readFtExtraMb(db, userId) {
  try {
    const row = await db
      .prepare("SELECT extra FROM user_quota_grants WHERE user_id = ? AND tool = ?")
      .bind(userId, "ft")
      .first();
    return Math.max(0, Number(row?.extra) || 0);
  } catch {
    return 0;
  }
}

export async function ftLimitBytes(db, userId) {
  return ftLimitFromExtraMb(await readFtExtraMb(db, userId));
}
