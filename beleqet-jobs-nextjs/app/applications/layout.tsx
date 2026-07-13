import { applicationsPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = applicationsPageMetadata();

export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
