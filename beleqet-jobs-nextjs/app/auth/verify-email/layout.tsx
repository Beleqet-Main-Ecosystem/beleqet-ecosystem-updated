import { verifyEmailPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = verifyEmailPageMetadata();

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
