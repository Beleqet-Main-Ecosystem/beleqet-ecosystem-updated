import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-brandGreen font-extrabold text-sm">404</p>
      <h1 className="text-pageH1 mt-2">Page not found</h1>
      <p className="text-muted mt-3">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="inline-block mt-6 rounded-full bg-brandGreen text-white text-sm font-semibold px-6 py-3 hover:bg-darkGreen transition-colors">
        Back to Home
      </Link>
    </div>
  );
}
