import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { normalizeOrderNo } from "@/utils/order-no";

export function parseOrderNoFromSearch(search: string) {
  const value = new URLSearchParams(search).get("order_no");
  return normalizeOrderNo(value);
}

export function useOrderNo() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });

  return useMemo(() => parseOrderNoFromSearch(search), [search]);
}
