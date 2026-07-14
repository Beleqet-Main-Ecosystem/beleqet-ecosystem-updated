import React from "react";
import { getSeoConfig } from "../config";

/**
 * `<script type="application/ld+json">` fragment describing the web site
 * itself.  Includes a `SearchAction` so that Google can render a sitelink
 * search box in SERPs.
 *
 * @see https://schema.org/WebSite
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export function WebSiteSchema(): React.ReactElement {
  const { siteUrl, siteName } = getSeoConfig();

  const json = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/jobs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
