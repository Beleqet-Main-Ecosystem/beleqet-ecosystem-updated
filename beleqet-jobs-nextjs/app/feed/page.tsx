import FeedClient from "./FeedClient";

/**
 * `/feed` route shell.
 *
 * Personalization requires the caller's JWT (stored in the browser), so the
 * actual data fetch happens client-side in `FeedClient`, not here on the
 * server — a server component has no access to `localStorage`.
 */
export default function FeedPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#00653B] mb-6">
        Your Personalized Job Feed
      </h1>
      <FeedClient />
    </div>
  );
}