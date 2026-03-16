import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? "mail.waketech.com",
    port:   parseInt(process.env.SMTP_PORT ?? "587"),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
});

const FROM = process.env.SMTP_FROM ?? "WakeEDI <noreply@waketech.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const ACCENT = "#3068ff";

// Shared email wrapper
function emailShell(appName: string, bodyHtml: string) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#0f172a;padding:32px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${appName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            ${bodyHtml}
            <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
            <p style="margin:0;color:#cbd5e1;font-size:12px;">&copy; ${new Date().getFullYear()} ${appName} &middot; Wake Tech</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
    const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
    const appName = "WakeEDI";
    await transporter.sendMail({
        from: FROM,
        to,
        subject: `Reset your ${appName} password`,
        html: emailShell(appName, `
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Reset your password</h1>
            <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi ${name}, we received a request to reset your password.</p>
            <a href="${resetUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Reset Password</a>
            <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `),
        text: `Hi ${name},\n\nReset your ${appName} password here:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.\n\n© ${new Date().getFullYear()} ${appName}`,
    });
}

export async function sendLoginOTPEmail(to: string, name: string, code: string) {
    const appName = "WakeEDI";
    await transporter.sendMail({
        from: FROM,
        to,
        subject: `Your ${appName} login code: ${code}`,
        html: emailShell(appName, `
            <div style="text-align:center;">
                <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your login code</h1>
                <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi ${name}, use this code to sign in.</p>
                <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;display:inline-block;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#0f172a;font-family:monospace;">${code}</span>
                </div>
                <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
            </div>
        `),
        text: `Hi ${name},\n\nYour ${appName} login code is: ${code}\n\nExpires in 10 minutes. Do not share this code.\n\n© ${new Date().getFullYear()} ${appName}`,
    });
}
