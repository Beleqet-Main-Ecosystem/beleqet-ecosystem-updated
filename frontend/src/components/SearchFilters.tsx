'use client'

import { X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface SearchFiltersProps {
  filters: {
    entityType: string
    minPrice: string
    maxPrice: string
    currency: string
    minRating: string
    skills: string[]
    location: string
    sortBy: string
    page: number
    limit: number
  }
  setFilters: (filters: any) => void
  onClear: () => void
}

export default function SearchFilters({ filters, setFilters, onClear }: SearchFiltersProps) {
  const { t } = useLanguage()

  const entityTypes = [
    { value: 'ALL', label: t('entityTypes.ALL') },
    { value: 'FREELANCER', label: t('entityTypes.FREELANCER') },
    { value: 'PROJECT', label: t('entityTypes.PROJECT') },
    { value: 'SERVICE', label: t('entityTypes.SERVICE') },
  ]

  const currencies = ['ETB', 'USD', 'EUR']

  const sortOptions = [
    { value: 'RELEVANCE', label: t('sortOptions.RELEVANCE') },
    { value: 'RATING_DESC', label: t('sortOptions.RATING_DESC') },
    { value: 'RATING_ASC', label: t('sortOptions.RATING_ASC') },
    { value: 'PRICE_ASC', label: t('sortOptions.PRICE_ASC') },
    { value: 'PRICE_DESC', label: t('sortOptions.PRICE_DESC') },
    { value: 'DATE_DESC', label: t('sortOptions.DATE_DESC') },
  ]

  const locations = [
    'Addis Ababa',
    'Hawassa',
    'Mekelle',
    'Bahir Dar',
    'Dire Dawa',
    'Adama',
    'Jimma',
    'Remote',
  ]

  const commonSkills = [
    'React',
    'Node.js',
    'TypeScript',
    'Python',
    'Java',
    'JavaScript',
    'PHP',
    'WordPress',
    'UI/UX Design',
    'Graphic Design',
  ]

  const toggleSkill = (skill: string) => {
    setFilters({
      ...filters,
      skills: filters.skills.includes(skill)
        ? filters.skills.filter((s) => s !== skill)
        : [...filters.skills, skill],
    })
  }

  return (
    <div className="border-t border-slate-200 pt-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{t('search.filters')}</h3>
        <button
          onClick={onClear}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('search.clearAll')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.entityType')}
          </label>
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-white"
          >
            {entityTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.currency')}
          </label>
          <select
            value={filters.currency}
            onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-white"
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.location')}
          </label>
          <select
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-white"
          >
            <option value="">{t('search.allLocations')}</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.minPrice')}
          </label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            placeholder="0"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.maxPrice')}
          </label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            placeholder="10000000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.minRating')}
          </label>
          <input
            type="number"
            value={filters.minRating}
            onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
            placeholder="0"
            min="0"
            max="5"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('search.sortBy')}
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-white"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('search.skills')}
        </label>
        <div className="flex flex-wrap gap-2">
          {commonSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.skills.includes(skill)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filters.skills.includes(skill) && (
                <X className="inline w-3 h-3 mr-1" />
              )}
              {skill}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
