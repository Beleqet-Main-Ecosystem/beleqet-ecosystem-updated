'use client';

import './old-home.css';
import { I18nProvider } from './old-home-i18n';
import OldHomeHeader from './OldHomeHeader';
import OldHome from './OldHome';

/**
 * The earlier landing page design for the home page: its own white header, hero and footer.
 * Everything it styles sits under .bq-home, so no other page is affected.
 */
export default function OldHomePage(props) {
  return (
    <div className="bq-home">
      <I18nProvider>
        <OldHomeHeader />
        <OldHome {...props} />
      </I18nProvider>
    </div>
  );
}
