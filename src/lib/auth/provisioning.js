import "server-only";

import { prisma } from "@/lib/prisma";

function normalizeName(value, email = "") {
  if (typeof value === "string" && value.trim()) {
    return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  const localPart = typeof email === "string" ? email.split("@")[0] : "";
  return localPart.trim().slice(0, 80) || "Customer";
}

function safeImageUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function ensureCustomerAccountById(userId) {
  if (typeof userId !== "string" || !userId) {
    return null;
  }

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        profile: true,
      },
    });

    if (!user || user.role !== "CUSTOMER") {
      return null;
    }

    const displayName = normalizeName(user.name, user.email || "");
    const imageUrl = safeImageUrl(user.image);
    const profile = await transaction.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName,
        imageUrl,
      },
      update: {},
    });

    return { user, profile };
  });
}

export async function createCredentialsCustomer({
  email,
  passwordHash,
  displayName,
  phone,
}) {
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      emailVerified: new Date(),
      name: displayName,
      passwordHash,
      role: "CUSTOMER",
      profile: {
        create: {
          displayName,
          phone: phone || null,
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      profile: true,
    },
  });
}
