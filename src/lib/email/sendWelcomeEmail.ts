import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type Tier = "FREE" | "MEMBER" | "DIAMOND";

export async function sendWelcomeEmail(args: { to: string; name?: string | null; tier: Tier }) {
  const { to, name, tier } = args;

  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  if (!process.env.RESEND_FROM) throw new Error("Missing RESEND_FROM");

  const greetName = (name ?? "").trim();
  const hi = greetName ? `Hey ${escapeHtml(greetName)}` : "Hey";

  const subject =
    tier === "DIAMOND"
      ? "Welcome to Xessex Diamond"
      : tier === "MEMBER"
      ? "Welcome to Xessex Member"
      : "Welcome to Xessex";

  const perks =
    tier === "DIAMOND"
      ? [
          "Full access to all videos",
          "Commenting enabled",
          "Ranking/voting enabled",
        ]
      : tier === "MEMBER"
      ? [
          "View all content",
          "Like/Dislike comments",
        ]
      : [
          "Browse showcase content",
          "Upgrade anytime to unlock more",
        ];

  const perksHtml = perks.map((p) => `<li>${escapeHtml(p)}</li>`).join("");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
    <h2 style="margin:0 0 12px 0">${hi}</h2>
    <p>Welcome to Xessex. Your account is ready.</p>
    <p><strong>Your access includes:</strong></p>
    <ul>${perksHtml}</ul>
    <p style="margin-top:16px">
      <a href="https://xessex.me/" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111;color:#fff;text-decoration:none">
        Enter Xessex
      </a>
    </p>
    <p style="margin-top:18px;color:#666;font-size:12px">
      If you didn't create this account, you can ignore this email.
    </p>
  </div>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM,
    to,
    subject,
    html,
  });
}

// tiny sanitizer (enough for names/perks)
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
