export function encodeOrderNoForSearch(orderNo: string) {
  return encodeURIComponent(JSON.stringify(orderNo));
}

export function normalizeOrderNo(value: unknown) {
  if (typeof value !== "string") return;

  const orderNo = value.trim();
  if (!orderNo) return;

  if (orderNo.startsWith('"') && orderNo.endsWith('"')) {
    try {
      const parsed = JSON.parse(orderNo);
      return typeof parsed === "string" && parsed ? parsed : undefined;
    } catch {
      return;
    }
  }

  return orderNo;
}
