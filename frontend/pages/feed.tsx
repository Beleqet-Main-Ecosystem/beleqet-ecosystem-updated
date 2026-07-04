import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export default function FeedPage() {
  const { t, i18n } = useTranslation('feed');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gdprConsent, setGdprConsent] = useState(true);

  // Fetch feed
  const fetchFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/ai-feed?limit=5');
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  // Toggle GDPR (for demo - calls a mock endpoint)
  const toggleGDPR = async () => {
    const newVal = !gdprConsent;
    setGdprConsent(newVal);
    // In production, PATCH /api/v1/users/me with { gdprConsent: newVal }
    await fetch('http://localhost:4000/api/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gdprConsent: newVal }),
    }).catch(() => {});
    fetchFeed(); // Refresh feed with new setting
  };

  // Multi-currency formatter
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(i18n.language === 'am' ? 'am-ET' : 'en-US', {
      style: 'currency',
      currency: currency || 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>{t('title')}</h1>

      {/* GDPR Toggle */}
      <button onClick={toggleGDPR} style={{ marginBottom: '20px' }}>
        {gdprConsent ? t('disable_personalization') : t('enable_personalization')}
      </button>

      {loading ? (
        <p>{t('loading')}</p>
      ) : jobs.length === 0 ? (
        <p>{t('no_jobs')}</p>
      ) : (
        jobs.map((job: any) => (
          <div key={job.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '8px' }}>
            <h3>{job.title}</h3>
            <p>{job.company?.name || 'Unknown Company'}</p>
            <p>📍 {job.location}</p>
            <p>📊 {t('match_score')}: {job.relevanceScore || 0}%</p>
            {job.salaryMin && (
              <p>💰 {formatCurrency(job.salaryMin, job.currency)} - {formatCurrency(job.salaryMax, job.currency)}</p>
            )}
            <button>{t('apply')}</button>
          </div>
        ))
      )}
    </div>
  );
}

export async function getStaticProps({ locale }: any) {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['feed'])),
    },
  };
    }
