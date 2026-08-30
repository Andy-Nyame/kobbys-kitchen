"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import useOperationalAutoRefresh from "@/components/operations/useOperationalAutoRefresh";
import { pathMatchesOperationalSurface } from "@/lib/operations/auto-refresh";

export default function OperationalAutoRefresh({
  exactPaths = [],
  prefixPaths = [],
}) {
  const pathname = usePathname();
  const router = useRouter();
  const enabled = pathMatchesOperationalSurface(pathname, {
    exactPaths,
    prefixPaths,
  });
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useOperationalAutoRefresh({ enabled, refresh });

  return null;
}
