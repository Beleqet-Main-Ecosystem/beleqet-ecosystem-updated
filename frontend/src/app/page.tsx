'use client'

import AdvancedSearch from '@/components/AdvancedSearch'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Home() {
  const { t } = useLanguage()

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              {t('search.title')}
            </h1>
            <p className="text-slate-600">{t('search.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </header>
        <AdvancedSearch />
      </div>
    </main>
  )
}
