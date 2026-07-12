'use client'

import { Star, MapPin, DollarSign, Clock } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface SearchResultsProps {
  results: any[]
  loading: boolean
}

export default function SearchResults({ results, loading }: SearchResultsProps) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>{t('search.noResults')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-600">{results.length} {t('search.resultsFound')}</p>
      </div>

      {results.map((result: any, index: number) => (
        <div
          key={index}
          className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {result.title || result.name || 'Untitled'}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                {result.entityType && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {result.entityType}
                  </span>
                )}
                {result.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {result.location}
                  </span>
                )}
              </div>
            </div>
            {result.rating && (
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-5 h-5 fill-current" />
                <span className="font-semibold">{result.rating}</span>
              </div>
            )}
          </div>

          {result.description && (
            <p className="text-slate-600 mb-3 line-clamp-2">{result.description}</p>
          )}

          {result.skills && result.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {result.skills.slice(0, 5).map((skill: string, skillIndex: number) => (
                <span
                  key={skillIndex}
                  className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                >
                  {skill}
                </span>
              ))}
              {result.skills.length > 5 && (
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                  +{result.skills.length - 5} more
                </span>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            {result.price && (
              <div className="flex items-center gap-1 text-green-600 font-semibold">
                <DollarSign className="w-4 h-4" />
                {result.price}
                {result.currency && <span className="text-sm">{result.currency}</span>}
              </div>
            )}
            {result.createdAt && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                {new Date(result.createdAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
