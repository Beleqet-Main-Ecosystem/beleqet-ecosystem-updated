'use client';

import { Heading } from '@/features/dashboard/ui';
import { useTranslation } from '@/lib/i18n';

export default function FeedHeading() {
  const { t } = useTranslation();
  return <Heading title={t('feed.title')} sub={t('feed.sub')} />;
}
