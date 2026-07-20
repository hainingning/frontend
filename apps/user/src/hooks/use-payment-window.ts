import { useEffect, useRef } from "react";

const PAYMENT_SUCCESS_STORAGE_KEY = "ppanel:payment-success";

type PaymentSuccessMessage = {
  orderNo: string;
  timestamp: number;
};

export function notifyPaymentSuccess(orderNo: string) {
  try {
    localStorage.setItem(
      PAYMENT_SUCCESS_STORAGE_KEY,
      JSON.stringify({ orderNo, timestamp: Date.now() })
    );
    localStorage.removeItem(PAYMENT_SUCCESS_STORAGE_KEY);
  } catch {
    // The opener can still close the tab after its next successful poll.
  }
}

export function usePaymentWindow(orderNo?: string) {
  const paymentWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const handlePaymentSuccess = (event: StorageEvent) => {
      if (
        event.key !== PAYMENT_SUCCESS_STORAGE_KEY ||
        !event.newValue ||
        !orderNo
      ) {
        return;
      }

      try {
        const message = JSON.parse(event.newValue) as PaymentSuccessMessage;
        if (message.orderNo !== orderNo) return;

        paymentWindowRef.current?.close();
        paymentWindowRef.current = null;
      } catch {
        // Ignore malformed cross-tab messages.
      }
    };

    window.addEventListener("storage", handlePaymentSuccess);
    return () => window.removeEventListener("storage", handlePaymentSuccess);
  }, [orderNo]);

  return paymentWindowRef;
}
