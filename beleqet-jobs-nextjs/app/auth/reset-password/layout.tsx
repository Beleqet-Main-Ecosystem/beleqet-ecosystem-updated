import { resetPasswordPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = resetPasswordPageMetadata();

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
