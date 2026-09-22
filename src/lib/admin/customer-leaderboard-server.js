import "server-only";

import { prisma } from "@/lib/prisma";
import { listCustomerLeaderboard } from "./customer-leaderboard.js";

export function getCustomerLeaderboard() {
  return listCustomerLeaderboard(prisma);
}
