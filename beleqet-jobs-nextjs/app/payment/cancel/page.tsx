import Link from "next/link";
import { XCircle } from "lucide-react";

/** PayPal's cancel_url when the payer backs out of approval (see PAYPAL_CANCEL_URL). */
export default function PaymentCancelPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <XCircle className="h-12 w-12 text-redAccent" />
      <h1 className="mt-4 text-2xl font-black text-primary">Checkout cancelled</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        No charge was made. You can pick a plan again whenever you&apos;re ready.
      </p>
      <Link
        href="/pricing"
        className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-brandGreen"
      >
        Back to plans
      </Link>
    </div>
  );
}
