import { adminPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = adminPageMetadata();

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
