import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../../src/lib/prisma.js";

const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
const email = `backend-acceptance-${Date.now()}@example.invalid`;
const originalPassword = `Aa!${randomBytes(12).toString("hex")}`;
const newPassword = `Bb!${randomBytes(12).toString("hex")}`;
const profileName = "Backend Acceptance Customer";
const reviewContent = `Backend migration acceptance review ${Date.now()}.`;

function updateCookies(response, jar) {
  const values = response.headers.getSetCookie?.() || [];

  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);

    if (!cookieValue || /max-age=0/i.test(value)) {
      jar.delete(name);
    } else {
      jar.set(name, cookieValue);
    }
  }
}

async function request(path, options = {}, jar = new Map()) {
  const headers = new Headers(options.headers || {});

  if (jar.size > 0) {
    headers.set(
      "Cookie",
      [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
    );
  }

  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers,
    redirect: "manual",
  });
  updateCookies(response, jar);
  return response;
}

async function jsonRequest(path, body, jar = new Map(), method = "POST") {
  return request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    jar
  );
}

const result = {
  signedOut: {},
  customer: {},
  passwordReset: {},
  admin: {},
  review: {},
};
let userId = null;
let reviewId = null;

try {
  const home = await request("/");
  result.signedOut.home = home.status;
  assert.equal(home.status, 200);

  const adminEntry = await request("/admin");
  const adminEntryHtml = await adminEntry.text();
  result.signedOut.adminLogin = adminEntry.status;
  assert.equal(adminEntry.status, 200);
  assert.match(adminEntryHtml, /Administration/);

  const protectedAccount = await request("/account");
  result.signedOut.account = protectedAccount.status;
  assert.ok([302, 303, 307, 308].includes(protectedAccount.status));

  const signup = await jsonRequest("/api/auth/signup", {
    displayName: "Acceptance Customer",
    email,
    phone: "020 123 4567",
    password: originalPassword,
  });
  result.customer.signup = signup.status;
  assert.equal(signup.status, 201);

  const databaseUser = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });
  assert.equal(databaseUser.role, "CUSTOMER");
  assert.ok(databaseUser.passwordHash.startsWith("$argon2id$"));
  assert.equal(databaseUser.profile.displayName, "Acceptance Customer");
  userId = databaseUser.id;

  const customerJar = new Map();
  const login = await jsonRequest(
    "/api/auth/login",
    { email, password: originalPassword },
    customerJar
  );
  result.customer.login = login.status;
  assert.equal(login.status, 200);
  assert.ok(customerJar.size > 0);

  const customerHome = await request("/", {}, customerJar);
  const customerHomeHtml = await customerHome.text();
  result.customer.headerAvatar = customerHomeHtml.includes("customer-account-menu");
  assert.equal(result.customer.headerAvatar, true);

  for (const path of ["/account", "/account/profile", "/account/orders"]) {
    const response = await request(path, {}, customerJar);
    result.customer[path] = response.status;
    assert.equal(response.status, 200);
  }

  const customerAdmin = await request("/admin", {}, customerJar);
  result.customer.adminDenied = customerAdmin.status;
  assert.ok([302, 303, 307, 308].includes(customerAdmin.status));

  const profileUpdate = await jsonRequest(
    "/api/account/profile",
    { displayName: profileName, phone: "+233 24 123 4567" },
    customerJar,
    "PATCH"
  );
  result.customer.profileUpdate = profileUpdate.status;
  assert.equal(profileUpdate.status, 200);

  const refreshedProfile = await request("/account/profile", {}, customerJar);
  const refreshedProfileHtml = await refreshedProfile.text();
  result.customer.profilePersisted = refreshedProfileHtml.includes(profileName);
  assert.equal(result.customer.profilePersisted, true);

  const reviewSubmission = await jsonRequest(
    "/api/reviews",
    {
      displayName: profileName,
      rating: 5,
      category: "Food",
      comment: reviewContent,
      contact: "",
      consent: true,
      website: "",
    },
    customerJar
  );
  result.review.submitted = reviewSubmission.status;
  assert.equal(reviewSubmission.status, 201);
  const review = await prisma.review.findFirst({ where: { content: reviewContent } });
  assert.equal(review.status, "PENDING");
  reviewId = review.id;

  const logout = await request(
    "/api/auth/logout",
    { method: "POST" },
    customerJar
  );
  result.customer.logout = logout.status;
  assert.equal(logout.status, 303);

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const recoveryJar = new Map();
  const exchange = await request(`/auth/reset?token=${encodeURIComponent(token)}`, {}, recoveryJar);
  result.passwordReset.exchange = exchange.status;
  assert.ok([302, 303, 307, 308].includes(exchange.status));

  const resetState = await request("/api/auth/reset-password", {}, recoveryJar);
  result.passwordReset.validState = resetState.status;
  assert.equal(resetState.status, 200);

  const reset = await jsonRequest(
    "/api/auth/reset-password",
    { password: newPassword, confirmPassword: newPassword },
    recoveryJar
  );
  result.passwordReset.updated = reset.status;
  assert.equal(reset.status, 200);

  const oldLogin = await jsonRequest(
    "/api/auth/login",
    { email, password: originalPassword },
    new Map()
  );
  result.passwordReset.oldPasswordRejected = oldLogin.status;
  assert.equal(oldLogin.status, 401);

  const newPasswordJar = new Map();
  const newLogin = await jsonRequest(
    "/api/auth/login",
    { email, password: newPassword },
    newPasswordJar
  );
  result.passwordReset.newPasswordAccepted = newLogin.status;
  assert.equal(newLogin.status, 200);

  await request("/api/auth/logout", { method: "POST" }, newPasswordJar);
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });

  const adminJar = new Map();
  const adminLogin = await jsonRequest(
    "/api/auth/admin-login",
    { email, password: newPassword, next: "/admin" },
    adminJar
  );
  result.admin.login = adminLogin.status;
  assert.equal(adminLogin.status, 200);

  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/payments",
    "/admin/analytics",
    "/admin/reviews",
    "/admin/settings",
  ]) {
    const response = await request(path, {}, adminJar);
    result.admin[path] = response.status;
    assert.equal(response.status, 200);
  }

  const approve = await jsonRequest(
    `/api/admin/reviews/${reviewId}`,
    { action: "APPROVE" },
    adminJar,
    "PATCH"
  );
  result.review.approved = approve.status;
  assert.equal(approve.status, 200);
  const publicApproved = await request("/api/reviews");
  const approvedPayload = await publicApproved.json();
  result.review.publicAfterApprove = approvedPayload.reviews.some(
    (item) => item.id === reviewId
  );
  assert.equal(result.review.publicAfterApprove, true);

  const reject = await jsonRequest(
    `/api/admin/reviews/${reviewId}`,
    { action: "HIDE" },
    adminJar,
    "PATCH"
  );
  result.review.rejected = reject.status;
  assert.equal(reject.status, 200);
  const publicRejected = await request("/api/reviews");
  const rejectedPayload = await publicRejected.json();
  result.review.publicAfterReject = rejectedPayload.reviews.some(
    (item) => item.id === reviewId
  );
  assert.equal(result.review.publicAfterReject, false);

  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  if (reviewId) {
    await prisma.review.deleteMany({ where: { id: reviewId } });
  }
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
}
