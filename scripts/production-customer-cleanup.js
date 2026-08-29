export const PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION =
  "--confirm-production-customer-cleanup";

export function requireCustomerCleanupConfirmation(argumentsList) {
  if (
    argumentsList.length !== 1 ||
    argumentsList[0] !== PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION
  ) {
    throw new Error(
      `Refusing Production cleanup without exactly ${PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION}.`
    );
  }
}

export async function cleanupProductionDummyCustomers({
  argumentsList,
  environment,
  prismaClient,
  verifyDatabase,
  audit = console.log,
}) {
  requireCustomerCleanupConfirmation(argumentsList);
  const configuration = await verifyDatabase(environment);

  return prismaClient.$transaction(async (transaction) => {
    const [admins, customerCount, orderCount, paymentCount, attemptCount] =
      await Promise.all([
        transaction.user.findMany({
          where: { role: "ADMIN" },
          select: {
            id: true,
            email: true,
            profile: { select: { id: true } },
            accounts: {
              where: { provider: "google" },
              select: { id: true },
            },
          },
          take: 2,
        }),
        transaction.user.count({ where: { role: "CUSTOMER" } }),
        transaction.order.count(),
        transaction.payment.count(),
        transaction.paymentAttempt.count(),
      ]);

    if (admins.length !== 1) {
      throw new Error("Cleanup requires exactly one trusted ADMIN.");
    }

    const [admin] = admins;
    if (admin.email?.toLowerCase() !== configuration.primaryAdminEmail) {
      throw new Error("The trusted ADMIN does not match PRIMARY_ADMIN_EMAIL.");
    }

    if (!admin.profile || admin.accounts.length !== 1) {
      throw new Error("The trusted ADMIN profile or Google identity is incomplete.");
    }

    if (orderCount > 0 || paymentCount > 0 || attemptCount > 0) {
      throw new Error(
        "Refusing customer cleanup because order or payment history exists."
      );
    }

    const customerIds = await transaction.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true },
    });
    const ids = customerIds.map((user) => user.id);
    const reviewsDeleted = ids.length
      ? await transaction.review.deleteMany({ where: { userId: { in: ids } } })
      : { count: 0 };
    const usersDeleted = ids.length
      ? await transaction.user.deleteMany({
          where: { id: { in: ids }, role: "CUSTOMER" },
        })
      : { count: 0 };

    if (usersDeleted.count !== customerCount) {
      throw new Error("Customer cleanup count changed during the transaction.");
    }

    const [remainingAdmins, remainingCustomers, adminAfter] = await Promise.all([
      transaction.user.count({ where: { role: "ADMIN" } }),
      transaction.user.count({ where: { role: "CUSTOMER" } }),
      transaction.user.findUnique({
        where: { id: admin.id },
        select: {
          role: true,
          profile: { select: { id: true } },
          accounts: {
            where: { provider: "google" },
            select: { id: true },
          },
        },
      }),
    ]);

    if (
      remainingAdmins !== 1 ||
      remainingCustomers !== 0 ||
      adminAfter?.role !== "ADMIN" ||
      !adminAfter.profile ||
      adminAfter.accounts.length !== 1
    ) {
      throw new Error("Post-cleanup identity invariants failed.");
    }

    const result = {
      ok: true,
      customersBefore: customerCount,
      customersDeleted: usersDeleted.count,
      customerReviewsDeleted: reviewsDeleted.count,
      customersAfter: remainingCustomers,
      adminsAfter: remainingAdmins,
    };
    audit(JSON.stringify(result));
    return result;
  });
}
