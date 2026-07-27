import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio Builder | Beleqet Jobs",
  description:
    "Create a professional digital portfolio — projects, skills, case studies, and more.",
  robots: { index: false, follow: false },
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
