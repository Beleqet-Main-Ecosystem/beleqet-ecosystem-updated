'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
    >
      <Globe className="w-4 h-4" />
      <span className="font-medium">{language === 'en' ? 'አማ' : 'EN'}</span>
    </button>
  )
}
