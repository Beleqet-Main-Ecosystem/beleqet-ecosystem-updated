'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SearchFilters from './SearchFilters'
import SearchResults from './SearchResults'
import { useLanguage } from '@/contexts/LanguageContext'

export default function AdvancedSearch() {
  const { t, language } = useLanguage()
  const [keyword, setKeyword] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    entityType: 'ALL',
    minPrice: '',
    maxPrice: '',
    currency: 'ETB',
    minRating: '',
    skills: [] as string[],
    location: '',
    sortBy: 'RELEVANCE',
    page: 1,
    limit: 20,
  })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    setLoading(true)
    setError('')
    
    try {
      const params = new URLSearchParams()
      if (keyword) params.append('keyword', keyword)
      if (filters.entityType !== 'ALL') params.append('entityType', filters.entityType)
      if (filters.minPrice) params.append('minPrice', filters.minPrice)
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice)
      if (filters.currency) params.append('currency', filters.currency)
      if (filters.minRating) params.append('minRating', filters.minRating)
      if (filters.skills.length > 0) params.append('skills', filters.skills.join(','))
      if (filters.location) params.append('location', filters.location)
      if (filters.sortBy !== 'RELEVANCE') params.append('sortBy', filters.sortBy)
      params.append('page', filters.page.toString())
      params.append('limit', filters.limit.toString())

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/advanced-search?${params.toString()}`,
        {
          headers: {
            'Accept-Language': language,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.data || [])
    } catch (err) {
      setError(t('search.error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      entityType: 'ALL',
      minPrice: '',
      maxPrice: '',
      currency: 'ETB',
      minRating: '',
      skills: [],
      location: '',
      sortBy: 'RELEVANCE',
      page: 1,
      limit: 20,
    })
    setKeyword('')
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 placeholder-slate-400"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors font-medium"
        >
          {loading ? t('search.searching') : t('search.searchButton')}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
        >
          {showFilters ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
          {t('search.filters')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {showFilters && (
        <SearchFilters
          filters={filters}
          setFilters={setFilters}
          onClear={clearFilters}
        />
      )}

      <SearchResults results={results} loading={loading} />
    </div>
  )
}
