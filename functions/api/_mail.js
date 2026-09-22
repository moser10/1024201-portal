/** Single source of truth for every automatic email sent by the portal Worker. */
export const SYSTEM_MAIL_FROM = "1024201@1024201.com";
export const MAIL_AUTO_LINE = "这是1024201自动发送的邮件，请勿回复。";
export const MAIL_CLOSE_LINE = "此致敬礼";

const CLOSE_RE = /此致敬礼|祝好|顺祝|Best regards|Sincerely|Yours truly/i;

export function wrapSystemMail(html) {
  let out = String(html || "");
  if (!out.includes("请勿回复")) {
    out += `<p style="margin:16px 0 8px;color:#636366;">${MAIL_AUTO_LINE}</p>`;
  }
  if (!CLOSE_RE.test(out)) {
    out += `<p style="margin:0 0 8px;">${MAIL_CLOSE_LINE}</p>`;
  }
  return out;
}

export function accountClosedMailHtml(username) {
  const name = String(username || "").trim() || "user";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.8;color:#1c1c1e;">
<p style="margin:0 0 12px;">你的账号 <strong>${name}</strong> 已经被注销。</p>
<p style="margin:0 0 16px;">感谢陪伴，祝好。</p>
</div>`;
}

export async function sendSystemMail(env, to, subject, html) {
  if (!env?.RESEND_API_KEY) {
    throw new Error("邮件服务未配置（RESEND_API_KEY）。请在 Cloudflare → Workers → 1024201-portal → Settings → Variables 添加 Secret。");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SYSTEM_MAIL_FROM,
      to,
      subject,
      html: wrapSystemMail(html),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`邮件发送失败 (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
}
