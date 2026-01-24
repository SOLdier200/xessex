/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

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

export async function sendWelcomeEmail(to: string, name?: string) {
  const from = process.env.EMAIL_FROM || "Xessex <no-reply@xessex.me>";
  const displayName = name || "there";

  const result = await resend.emails.send({
    from,
    to,
    subject: "Welcome to Xessex!",
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0b0f;padding:30px">
        <div style="max-width:480px;margin:auto;background:#111;border-radius:16px;padding:28px;color:#fff">
          <h2 style="color:#ff4fd8;margin-top:0">Welcome to Xessex!</h2>
          <p>Hey ${displayName},</p>
          <p>Thanks for signing up! Your account is now active.</p>
          <p>Explore our content and enjoy everything Xessex has to offer.</p>

          <a href="https://xessex.me" style="
            display:inline-block;
            margin-top:20px;
            padding:14px 22px;
            background:#ff4fd8;
            color:#000;
            font-weight:700;
            border-radius:12px;
            text-decoration:none;
          ">
            Visit Xessex
          </a>

          <p style="margin-top:24px;font-size:12px;color:#aaa">
            If you have any questions, feel free to reach out.
          </p>
        </div>
      </div>
    `,
  });

  const id =
    (result as { data?: { id?: string } })?.data?.id ||
    (result as { id?: string })?.id ||
    null;

  return { id };
}

export async function sendDiamondRecoveryEmail(to: string, recoverLink: string) {
  const from = process.env.EMAIL_FROM || "Xessex <no-reply@xessex.me>";

  const result = await resend.emails.send({
    from,
    to,
    subject: "Restore your Diamond membership",
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0b0f;padding:30px">
        <div style="max-width:520px;margin:auto;background:#111;border-radius:16px;padding:28px;color:#fff">
          <h2 style="color:#ff4fd8;margin-top:0">Restore Diamond Membership</h2>

          <p>You requested to restore your Diamond membership to a new wallet.</p>
          <p>This link is valid for <b>30 minutes</b>.</p>

          <a href="${recoverLink}" style="
            display:inline-block;
            margin-top:20px;
            padding:14px 22px;
            background:#ff4fd8;
            color:#000;
            font-weight:700;
            border-radius:12px;
            text-decoration:none;
          ">
            Restore Membership
          </a>

          <p style="margin-top:18px;font-size:12px;color:#aaa">
            If you did not request this, you can ignore this email.
          </p>

          <div style="margin-top:16px;padding:12px;border-radius:12px;background:#0e0e14;color:#bbb;font-size:12px;line-height:1.4">
            <b>Security tip:</b> Only restore after connecting a wallet you fully control.
          </div>
        </div>
      </div>
    `,
  });

  const id =
    (result as { data?: { id?: string } })?.data?.id ||
    (result as { id?: string })?.id ||
    null;

  return { id };
}

export async function sendDiamondRecoveryEmailVerify(to: string, verifyLink: string) {
  const from = process.env.EMAIL_FROM || "Xessex <no-reply@xessex.me>";

  const result = await resend.emails.send({
    from,
    to,
    subject: "Verify your Diamond recovery email",
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0b0f;padding:30px">
        <div style="max-width:520px;margin:auto;background:#111;border-radius:16px;padding:28px;color:#fff">
          <h2 style="color:#ff4fd8;margin-top:0">Verify Recovery Email</h2>

          <p>This email will be used only to restore your Diamond membership if you lose access to your wallet.</p>
          <p>This link is valid for <b>30 minutes</b>.</p>

          <a href="${verifyLink}" style="
            display:inline-block;
            margin-top:20px;
            padding:14px 22px;
            background:#ff4fd8;
            color:#000;
            font-weight:700;
            border-radius:12px;
            text-decoration:none;
          ">
            Verify Email
          </a>

          <p style="margin-top:18px;font-size:12px;color:#aaa">
            If you didn't request this, you can ignore this email.
          </p>
        </div>
      </div>
    `,
  });

  const id =
    (result as { data?: { id?: string } })?.data?.id ||
    (result as { id?: string })?.id ||
    null;

  return { id };
}
