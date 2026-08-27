import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import {
  renderEmailLayout,
  emailButton,
  emailFallbackLink,
  emailDivider,
  emailTextStyle,
  emailTitleStyle,
} from "./emailTemplates.js";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

const ENV_DEFAULTS: Record<string, string> = {
  smtp_host: process.env.SMTP_HOST ?? "",
  smtp_port: process.env.SMTP_PORT ?? "587",
  smtp_secure: process.env.SMTP_SECURE ?? "false",
  smtp_user: process.env.SMTP_USER ?? "",
  smtp_password: process.env.SMTP_PASSWORD ?? "",
  smtp_from: process.env.SMTP_FROM ?? "",
};

async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? ENV_DEFAULTS[key] ?? "";
}

/** Returns null when SMTP hasn't been configured yet (no host or sender set). */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const [host, port, secure, user, password, from] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_secure"),
    getSetting("smtp_user"),
    getSetting("smtp_password"),
    getSetting("smtp_from"),
  ]);

  if (!host || !from) return null;

  return {
    host,
    port: Number(port) || 587,
    secure: secure === "true",
    user,
    password,
    from,
  };
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured");
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });

  await transport.sendMail({
    from: config.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

function buildPasswordResetEmail(resetUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Justif - Réinitialisation de mot de passe / Password reset";
  const text = [
    "Bonjour,",
    "",
    "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Justif.",
    "Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :",
    resetUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.",
    "",
    "---",
    "",
    "Hello,",
    "",
    "A password reset was requested for your Justif account.",
    "Click the link below to choose a new password (valid for 1 hour):",
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
  const html = renderEmailLayout({
    preheader: "Réinitialisez votre mot de passe Justif / Reset your Justif password",
    bodyHtml: `
      <p style="${emailTitleStyle}">Réinitialisation de mot de passe</p>
      <p style="${emailTextStyle}">Bonjour,</p>
      <p style="${emailTextStyle}">
        Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Justif.
        Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (valable 1 heure).
      </p>
      ${emailButton("Réinitialiser mon mot de passe", resetUrl)}
      ${emailFallbackLink(resetUrl)}
      <p style="${emailTextStyle} margin-bottom: 0;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
      </p>
      ${emailDivider}
      <p style="${emailTitleStyle}">Password reset</p>
      <p style="${emailTextStyle}">Hello,</p>
      <p style="${emailTextStyle}">
        A password reset was requested for your Justif account. Click the button below to
        choose a new password (valid for 1 hour).
      </p>
      ${emailButton("Reset my password", resetUrl)}
      ${emailFallbackLink(resetUrl)}
      <p style="${emailTextStyle} margin-bottom: 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `,
  });
  return { subject, text, html };
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { subject, text, html } = buildPasswordResetEmail(resetUrl);
  await sendMail({ to, subject, text, html });
}

export async function sendTestEmail(to: string): Promise<void> {
  const html = renderEmailLayout({
    preheader: "Votre configuration SMTP fonctionne / Your SMTP configuration works",
    bodyHtml: `
      <p style="${emailTitleStyle}">Email de test</p>
      <p style="${emailTextStyle}">
        Cet email confirme que la configuration SMTP de votre instance Justif fonctionne.
      </p>
      ${emailDivider}
      <p style="${emailTitleStyle}">Test email</p>
      <p style="${emailTextStyle} margin-bottom: 0;">
        This email confirms your Justif instance's SMTP configuration works.
      </p>
    `,
  });
  await sendMail({
    to,
    subject: "Justif - Email de test / Test email",
    text: "Cet email confirme que la configuration SMTP de votre instance Justif fonctionne.\n\nThis email confirms your Justif instance's SMTP configuration works.",
    html,
  });
}
