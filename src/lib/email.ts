import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set");
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const from = process.env.EMAIL_FROM || "Xessex <no-reply@xessex.me>";

  const result = await resend.emails.send({
    from,
    to,
    subject: "Reset your Xessex password",
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0b0f;padding:30px">
        <div style="max-width:480px;margin:auto;background:#111;border-radius:16px;padding:28px;color:#fff">
          <h2 style="color:#ff4fd8;margin-top:0">Reset your password</h2>
          <p>You requested to reset your Xessex password.</p>
          <p>This link is valid for <b>30 minutes</b>.</p>

          <a href="${resetLink}" style="
            display:inline-block;
            margin-top:20px;
            padding:14px 22px;
            background:#ff4fd8;
            color:#000;
            font-weight:700;
            border-radius:12px;
            text-decoration:none;
          ">
            Reset Password
          </a>

          <p style="margin-top:24px;font-size:12px;color:#aaa">
            If you did not request this, you can ignore this email.
          </p>
        </div>
      </div>
    `,
  });

  // Resend SDK returns { data: { id }, error } style - be defensive
  const id =
    (result as { data?: { id?: string } })?.data?.id ||
    (result as { id?: string })?.id ||
    null;

  return { id };
}
