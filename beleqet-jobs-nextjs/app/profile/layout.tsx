import { profilePageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = profilePageMetadata();

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
