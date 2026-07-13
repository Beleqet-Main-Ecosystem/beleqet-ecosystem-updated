import React from "react";
import { getSeoConfig } from "../config";

/** A single breadcrumb list item. */
export interface BreadcrumbItem {
  /** Display name (e.g. "Jobs", "Senior Developer at X"). */
  name: string;
  /** Relative or absolute URL. */
  href: string;
}

/**
 * `<script type="application/ld+json">` fragment for `BreadcrumbList`
 * structured data.  Place on any page that has a visible breadcrumb trail
 * (job detail pages, category pages, etc.).
 *
 * @see https://schema.org/BreadcrumbList
 */
export function BreadcrumbSchema({
  items,
}: {
  items: BreadcrumbItem[];
}): React.ReactElement {
  const { siteUrl } = getSeoConfig();

  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : `${siteUrl.replace(/\/+$/, "")}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
