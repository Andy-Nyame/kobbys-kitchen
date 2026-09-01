export const PRODUCTION_TEST_ORDER_PURGE_CONFIRMATION =
  "--confirm-test-order-purge";

const TRANSACTION_COUNT_KEYS = Object.freeze([
  "orders",
  "orderItems",
  "orderStatusHistory",
  "payments",
  "paymentAttempts",
  "receipts",
  "refunds",
  "activePickupCredentials",
]);

function getCleanupMode(argumentsList) {
  if (argumentsList.length === 0) return "dry_run";
  if (
    argumentsList.length === 1 &&
    argumentsList[0] === PRODUCTION_TEST_ORDER_PURGE_CONFIRMATION
  ) {
    return "purge";
  }
  throw new Error(
    `Refusing Production purge without exactly ${PRODUCTION_TEST_ORDER_PURGE_CONFIRMATION}.`,
  );
}

export function requirePaystackTestMode(environment) {
  const key = environment.PAYSTACK_SECRET_KEY?.trim() || "";

  if (key.startsWith("sk_live_")) {
    throw new Error("LIVE CONFIGURATION DETECTED. Refusing Production test-data purge.");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error(
      "Paystack Test Mode could not be verified. Refusing Production test-data purge.",
    );
  }

  return "TEST";
}

export async function readProductionCleanupCounts(prismaClient) {
  const [
    users,
    profiles,
    authAccounts,
    admins,
    chefs,
    customers,
    menuCategories,
    menuItems,
    menuItemImages,
    businessHoursSettings,
    businessHoursWindows,
    orderingSettings,
    orderingScheduleWindows,
    reviews,
    reviewModeration,
    orders,
    orderItems,
    orderStatusHistory,
    payments,
    paymentAttempts,
    receipts,
    refunds,
    activePickupCredentials,
  ] = await Promise.all([
    prismaClient.user.count(),
    prismaClient.profile.count(),
    prismaClient.account.count(),
    prismaClient.user.count({ where: { role: "ADMIN" } }),
    prismaClient.user.count({ where: { role: "CHEF" } }),
    prismaClient.user.count({ where: { role: "CUSTOMER" } }),
    prismaClient.menuCategory.count(),
    prismaClient.menuItem.count(),
    prismaClient.menuItemImage.count(),
    prismaClient.businessHoursSetting.count(),
    prismaClient.businessHoursWindow.count(),
    prismaClient.orderingSetting.count(),
    prismaClient.orderingScheduleWindow.count(),
    prismaClient.review.count(),
    prismaClient.reviewModeration.count(),
    prismaClient.order.count(),
    prismaClient.orderItem.count(),
    prismaClient.orderStatusHistory.count(),
    prismaClient.payment.count(),
    prismaClient.paymentAttempt.count(),
    prismaClient.receipt.count(),
    prismaClient.refund.count(),
    prismaClient.order.count({ where: { pickupCode: { not: null } } }),
  ]);

  return {
    preserve: {
      users,
      profiles,
      authAccounts,
      roles: { ADMIN: admins, CHEF: chefs, CUSTOMER: customers },
      menuCategories,
      menuItems,
      menuItemImages,
      businessHoursSettings,
      businessHoursWindows,
      orderingSettings,
      orderingScheduleWindows,
      reviews,
      reviewModeration,
    },
    delete: {
      orders,
      orderItems,
      orderStatusHistory,
      payments,
      paymentAttempts,
      receipts,
      refunds,
      activePickupCredentials,
    },
  };
}

function assertZeroTransactionCounts(counts) {
  for (const key of TRANSACTION_COUNT_KEYS) {
    if (counts[key] !== 0) {
      throw new Error(`Post-cleanup transaction count is not zero: ${key}.`);
    }
  }
}

function assertPreservedCounts(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Preserved Production counts changed during cleanup.");
  }
}

function assertDeletedCounts(before, deleted) {
  for (const key of [
    "orders",
    "orderItems",
    "orderStatusHistory",
    "payments",
    "paymentAttempts",
    "receipts",
    "refunds",
  ]) {
    if (deleted[key] !== before[key]) {
      throw new Error(`Transactional cleanup count changed unexpectedly: ${key}.`);
    }
  }
}

async function purgeTransactionData(transaction) {
  const refunds = await transaction.refund.deleteMany();
  const receipts = await transaction.receipt.deleteMany();
  const paymentAttempts = await transaction.paymentAttempt.deleteMany();
  const payments = await transaction.payment.deleteMany();
  const orderStatusHistory = await transaction.orderStatusHistory.deleteMany();
  const orderItems = await transaction.orderItem.deleteMany();
  const orders = await transaction.order.deleteMany();

  return {
    refunds: refunds.count,
    receipts: receipts.count,
    paymentAttempts: paymentAttempts.count,
    payments: payments.count,
    orderStatusHistory: orderStatusHistory.count,
    orderItems: orderItems.count,
    orders: orders.count,
  };
}

export async function cleanupProductionTestOrders({
  argumentsList,
  environment,
  prismaClient,
  verifyDatabase,
  audit = console.log,
}) {
  const mode = getCleanupMode(argumentsList);
  const paystackMode = requirePaystackTestMode(environment);
  await verifyDatabase(environment);

  if (mode === "dry_run") {
    const counts = await readProductionCleanupCounts(prismaClient);
    const result = { ok: true, status: "dry_run", paystackMode, ...counts };
    audit(JSON.stringify(result));
    return result;
  }

  const result = await prismaClient.$transaction(
    async (transaction) => {
      const before = await readProductionCleanupCounts(transaction);
      const deleted = await purgeTransactionData(transaction);
      const after = await readProductionCleanupCounts(transaction);

      assertDeletedCounts(before.delete, deleted);
      assertZeroTransactionCounts(after.delete);
      assertPreservedCounts(before.preserve, after.preserve);

      return {
        ok: true,
        status: "purged",
        paystackMode,
        before,
        deleted,
        after,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  audit(JSON.stringify(result));
  return result;
}
