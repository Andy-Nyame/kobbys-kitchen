import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_COOKIE = "kk_password_reset";
export const PASSWORD_RESET_MAX_AGE_SECONDS = 30 * 60;

export function hashResetToken(token) {
  if (typeof token !== "string" || token.length < 32) {
    return null;
  }

  return createHash("sha256").update(token).digest("hex");
}

export function getPasswordResetCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PASSWORD_RESET_MAX_AGE_SECONDS,
  };
}

export async function createPasswordResetToken(userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_MAX_AGE_SECONDS * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ]);

  return token;
}

export async function getValidPasswordResetRecord(token) {
  const tokenHash = hashResetToken(token);

  if (!tokenHash) {
    return null;
  }

  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });
}

export async function sendPasswordResetEmail({ email, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("password_reset_email_not_configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your Kobby’s Kitchen password",
      text: `Use this secure link to reset your Kobby’s Kitchen password. It expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    throw new Error("password_reset_email_failed");
  }
}
