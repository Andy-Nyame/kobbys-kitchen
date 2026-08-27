import "server-only";

import argon2 from "argon2";

import { prisma } from "@/lib/prisma";
import { ensureCustomerAccountById } from "@/lib/auth/provisioning";

export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function authenticateCredentials({ email, password, role = null }) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || typeof password !== "string") {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user?.passwordHash || (role && user.role !== role)) {
    return null;
  }

  let valid = false;

  try {
    valid = await argon2.verify(user.passwordHash, password);
  } catch {
    valid = false;
  }

  if (!valid) {
    return null;
  }

  if (user.role === "CUSTOMER") {
    await ensureCustomerAccountById(user.id);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}
