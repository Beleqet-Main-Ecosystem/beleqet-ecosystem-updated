import { forgotPasswordPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = forgotPasswordPageMetadata();

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
