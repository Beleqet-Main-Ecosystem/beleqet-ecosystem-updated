import React from "react";
import { getSeoConfig } from "../config";

/**
 * `<script type="application/ld+json">` fragment describing the organisation
 * behind the platform.  Used primarily on the About page and as a fallback
 * on other pages.
 *
 * @see https://schema.org/Organization
 */
export function OrganizationSchema(): React.ReactElement {
  const { organization } = getSeoConfig();

  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organization.name,
    url: organization.url,
    logo: organization.logo,
    email: organization.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: organization.address,
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: organization.email,
      contactType: "customer support",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
