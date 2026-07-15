import { postJobPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = postJobPageMetadata();

export default function PostJobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
