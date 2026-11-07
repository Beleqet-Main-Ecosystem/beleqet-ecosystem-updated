import { redirect } from 'next/navigation';

/** Where Chapa returns a plan payer; the plan page then waits for that payment. */
export default function ChapaReturnPage({ params }: { params: { id: string } }) {
  redirect(`/employer?tab=plan&payment=${encodeURIComponent(params.id)}`);
}
