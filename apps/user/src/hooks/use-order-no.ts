import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { normalizeOrderNo } from "@/utils/order-no";

export function parseOrderNoFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get("order_no") ?? params.get("amp;order_no");
  return normalizeOrderNo(value);
}

export function parsePaymentReturnFromSearch(search: string) {
  const params = new URLSearchParams(search);
  return (
    params.get("payment_return") === "1" ||
    params.get("amp;payment_return") === "1"
  );
}

export function useOrderNo() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });

  return useMemo(() => parseOrderNoFromSearch(search), [search]);
}

export function useIsPaymentReturn() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });

  return useMemo(() => parsePaymentReturnFromSearch(search), [search]);
}
