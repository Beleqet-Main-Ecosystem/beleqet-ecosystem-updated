'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SalaryStatisticsDto } from '../dto/salary-prediction.dto';

/**
 * SalaryAnalyticsDashboard - Dashboard for viewing salary analytics and trends
 *
 * Features:
 * - Location-based salary statistics
 * - Industry filtering
 * - Salary growth rate visualization
 * - Multi-currency support
 * - Data points indication
 */
export const SalaryAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [statistics, setStatistics] = useState<SalaryStatisticsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState('Addis Ababa');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<'ETB' | 'USD' | 'EUR'>('ETB');

  /**
   * Fetch salary statistics from API
   */
  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        daysBack: '30',
        currency: selectedCurrency,
      });
      if (selectedIndustry !== 'all') {
        queryParams.set('industry', selectedIndustry);
      }

      const response = await fetch(
        `/api/v1/salary/statistics/${encodeURIComponent(selectedLocation)}?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, selectedIndustry, selectedCurrency]);

  /**
   * Format currency value with appropriate symbol
   */
  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      ETB: 'ብር',
      USD: '$',
      EUR: '€',
    };
    return `${amount.toLocaleString()} ${symbols[currency] || currency}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('salary.statistics.title', 'Salary Statistics Dashboard')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('salary.statistics.description', 'Market analytics and salary trends')}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('salary.prediction.request.location', 'Location')}
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Addis Ababa">Addis Ababa</option>
                <option value="Dire Dawa">Dire Dawa</option>
                <option value="Hawassa">Hawassa</option>
                <option value="Mekelle">Mekelle</option>
                <option value="Adama">Adama</option>
                <option value="Bahir Dar">Bahir Dar</option>
              </select>
            </div>

            {/* Industry Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('salary.prediction.request.industry', 'Industry')}
              </label>
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Industries</option>
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Consulting">Consulting</option>
              </select>
            </div>

            {/* Currency Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('salary.prediction.request.currency', 'Currency')}
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ETB">ETB (Ethiopian Birr)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        {!loading && statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Average Salary */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">
                {t('salary.prediction.response.averageSalary', 'Average Salary')}
              </p>
              <p className="text-3xl font-bold text-green-700">
                {formatCurrency(statistics.averageSalary, statistics.currency)}
              </p>
            </div>

            {/* Median Salary */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">
                {t('salary.prediction.response.medianSalary', 'Median Salary')}
              </p>
              <p className="text-3xl font-bold text-blue-700">
                {formatCurrency(statistics.medianSalary, statistics.currency)}
              </p>
            </div>

            {/* Growth Rate */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">
                {t('salary.statistics.salaryGrowthRate', 'Growth Rate')}
              </p>
              <p className={`text-3xl font-bold ${statistics.salaryGrowthRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {statistics.salaryGrowthRate > 0 ? '+' : ''}
                {statistics.salaryGrowthRate.toFixed(1)}%
                <span className="text-sm font-normal text-gray-500 ml-1">MoM</span>
              </p>
            </div>

            {/* Data Points */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-gray-600 mb-2">
                {t('salary.prediction.response.dataPointsCount', 'Data Points')}
              </p>
              <p className="text-3xl font-bold text-purple-700">
                {statistics.dataPointsCount}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* No Data State */}
        {!loading && !statistics && !error && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No statistics available</p>
            <p className="text-sm text-gray-400 mt-2">
              Select a location to view salary analytics
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryAnalyticsDashboard;