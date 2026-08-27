export function canUsePasswordRecovery(user) {
  if (!user?.id || !user.email) {
    return false;
  }

  if (user.passwordHash) {
    return true;
  }

  const hasOAuthIdentity = (user.accounts || []).some(
    (account) => account.type === "oauth"
  );

  return !hasOAuthIdentity;
}
