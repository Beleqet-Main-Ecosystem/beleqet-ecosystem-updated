import { cvMakerPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = cvMakerPageMetadata();

export default function CvMakerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
