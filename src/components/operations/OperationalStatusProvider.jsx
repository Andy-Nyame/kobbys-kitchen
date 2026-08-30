"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import useOperationalAutoRefresh from "@/components/operations/useOperationalAutoRefresh";
import { pathMatchesOperationalSurface } from "@/lib/operations/auto-refresh";

const OperationalStatusContext = createContext(null);

export function useLiveOrderingStatus(initialStatus) {
  const context = useContext(OperationalStatusContext);
  return context?.orderingStatus || initialStatus;
}

export function useLiveCustomerOrderOverview(initialOverview) {
  const context = useContext(OperationalStatusContext);
  return context?.customerOverview === undefined
    ? initialOverview
    : context.customerOverview;
}

export default function OperationalStatusProvider({
  children,
  exactPaths = [],
  prefixPaths = [],
  refreshServerExactPaths = [],
  refreshServerPrefixPaths = [],
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState({
    orderingStatus: undefined,
    customerOverview: undefined,
  });
  const enabled = pathMatchesOperationalSurface(pathname, {
    exactPaths,
    prefixPaths,
  });
  const refreshServerData = pathMatchesOperationalSurface(pathname, {
    exactPaths: refreshServerExactPaths,
    prefixPaths: refreshServerPrefixPaths,
  });
  const refresh = useCallback(async () => {
    const response = await fetch("/api/operational-status", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Operational refresh was unavailable.");
    }

    const result = await response.json();
    if (!result?.ok) {
      throw new Error("Operational refresh was unavailable.");
    }

    setState({
      orderingStatus: result.orderingStatus,
      customerOverview: result.customerOverview,
    });

    if (refreshServerData) {
      router.refresh();
    }
  }, [refreshServerData, router]);

  useOperationalAutoRefresh({ enabled, refresh });

  const value = useMemo(
    () => ({
      orderingStatus: state.orderingStatus,
      customerOverview: state.customerOverview,
    }),
    [state.customerOverview, state.orderingStatus]
  );

  return (
    <OperationalStatusContext.Provider value={value}>
      {children}
    </OperationalStatusContext.Provider>
  );
}
