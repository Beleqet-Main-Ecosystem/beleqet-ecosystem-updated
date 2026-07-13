import { employerPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = employerPageMetadata();

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
