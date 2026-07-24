'use client';

import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ExperienceLevel } from '../dto/salary-prediction.dto';

interface SalaryPredictionRequest {
  jobTitle: string;
  location: string;
  experienceLevel: ExperienceLevel;
  industry?: string;
  currency?: string;
}

interface SalaryPredictionResponse {
  id: string;
  jobTitle: string;
  location: string;
  experienceLevel: string;
  industry?: string;
  minSalary: number;
  maxSalary: number;
  averageSalary: number;
  medianSalary: number;
  currency: string;
  dataPointsCount: number;
  standardDeviation: number;
  confidenceScore: number;
  version: number;
  lastUpdatedAt: Date;
  createdAt: Date;
}

/**
 * SalaryCalculator - Main React component for salary prediction
 *
 * Features:
 * - Single job salary prediction
 * - Real-time form validation
 * - Beautiful UI with Tailwind CSS
 * - Multi-language support (i18n)
 * - Loading states and error handling
 * - Responsive design for mobile and desktop
 */
export const SalaryCalculator: React.FC = () => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors, isLoading },
    reset,
  } = useForm<SalaryPredictionRequest>({
    defaultValues: {
      jobTitle: '',
      location: 'Addis Ababa',
      experienceLevel: ExperienceLevel.MID,
      industry: 'Technology',
      currency: 'ETB',
    },
  });

  const [prediction, setPrediction] = useState<SalaryPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handle salary prediction form submission
   */
  const onSubmit = useCallback(async (data: SalaryPredictionRequest) => {
    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      const response = await fetch('/api/v1/salary/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to predict salary');
      }

      const result = await response.json();
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('salary.title', 'AI Salary Helper')}
          </h1>
          <p className="text-lg text-gray-600">
            {t(
              'salary.prediction.description',
              'Get AI-powered salary predictions based on market data',
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('salary.prediction.request.jobTitle', 'Job Title')}
                </label>
                <Controller
                  name="jobTitle"
                  control={control}
                  rules={{
                    required: t('salary.errors.jobTitleRequired', 'Job title is required'),
                    minLength: { value: 2, message: 'Minimum 2 characters' },
                  }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g., Senior Software Engineer"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                        errors.jobTitle ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  )}
                />
                {errors.jobTitle && (
                  <p className="text-red-500 text-sm mt-1">{errors.jobTitle.message}</p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('salary.prediction.request.location', 'Location')}
                </label>
                <Controller
                  name="location"
                  control={control}
                  rules={{
                    required: t('salary.errors.locationRequired', 'Location is required'),
                  }}
                  render={({ field }) => (
                    <select
                      {...field}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                        errors.location ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="Addis Ababa">Addis Ababa</option>
                      <option value="Dire Dawa">Dire Dawa</option>
                      <option value="Hawassa">Hawassa</option>
                      <option value="Mekelle">Mekelle</option>
                      <option value="Adama">Adama</option>
                      <option value="Bahir Dar">Bahir Dar</option>
                    </select>
                  )}
                />
                {errors.location && (
                  <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>
                )}
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('salary.prediction.request.experienceLevel', 'Experience Level')}
                </label>
                <Controller
                  name="experienceLevel"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value={ExperienceLevel.JUNIOR}>
                        {t('salary.experienceLevels.JUNIOR', 'Junior (0-2 years)')}
                      </option>
                      <option value={ExperienceLevel.MID}>
                        {t('salary.experienceLevels.MID', 'Mid-level (2-5 years)')}
                      </option>
                      <option value={ExperienceLevel.SENIOR}>
                        {t('salary.experienceLevels.SENIOR', 'Senior (5-10 years)')}
                      </option>
                      <option value={ExperienceLevel.LEAD}>
                        {t('salary.experienceLevels.LEAD', 'Lead (10+ years)')}
                      </option>
                      <option value={ExperienceLevel.PRINCIPAL}>
                        {t('salary.experienceLevels.PRINCIPAL', 'Principal/Executive (15+ years)')}
                      </option>
                    </select>
                  )}
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('salary.prediction.request.industry', 'Industry')}
                </label>
                <Controller
                  name="industry"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value="Technology">
                        {t('salary.industries.Technology', 'Technology')}
                      </option>
                      <option value="Finance">{t('salary.industries.Finance', 'Finance')}</option>
                      <option value="Healthcare">
                        {t('salary.industries.Healthcare', 'Healthcare')}
                      </option>
                      <option value="Education">
                        {t('salary.industries.Education', 'Education')}
                      </option>
                      <option value="Telecommunications">
                        {t('salary.industries.Telecommunications', 'Telecommunications')}
                      </option>
                      <option value="Consulting">
                        {t('salary.industries.Consulting', 'Management Consulting')}
                      </option>
                    </select>
                  )}
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('salary.prediction.request.currency', 'Currency')}
                </label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value="ETB">ETB (Ethiopian Birr)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  )}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
              >
                {loading ? 'Predicting...' : 'Get Salary Prediction'}
              </button>

              {/* Reset Button */}
              <button
                type="button"
                onClick={() => {
                  reset();
                  setPrediction(null);
                  setError(null);
                }}
                className="w-full py-2 px-4 rounded-lg font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
              >
                Clear
              </button>
            </form>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            {!prediction ? (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-gray-500 text-lg">
                  {loading
                    ? '📊 Calculating salary prediction...'
                    : '📝 Fill out the form and click "Get Salary Prediction"'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">{prediction.jobTitle}</h2>

                {/* Main Salary Display */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-2">Average Salary</p>
                  <p className="text-4xl font-bold text-green-700">
                    {prediction.averageSalary.toLocaleString()}
                    <span className="text-xl ml-2">{prediction.currency}</span>
                  </p>
                </div>

                {/* Salary Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Min Salary</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {prediction.minSalary.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Max Salary</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {prediction.maxSalary.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Statistics */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600">Median Salary</span>
                    <span className="font-semibold">
                      {prediction.medianSalary.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600">Std. Deviation</span>
                    <span className="font-semibold">
                      {prediction.standardDeviation.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600">Data Points</span>
                    <span className="font-semibold">{prediction.dataPointsCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Confidence Score</span>
                    <span className="font-semibold text-green-600">
                      {(prediction.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Confidence Indicator */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-2">Prediction Confidence</p>
                  <div className="w-full bg-gray-300 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        prediction.confidenceScore > 0.8
                          ? 'bg-green-500'
                          : prediction.confidenceScore > 0.6
                            ? 'bg-yellow-500'
                            : 'bg-orange-500'
                      }`}
                      style={{ width: `${prediction.confidenceScore * 100}%` }}
                    />
                  </div>
                </div>

                {/* Meta Information */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Updated: {new Date(prediction.lastUpdatedAt).toLocaleDateString()}</p>
                  <p>Version: {prediction.version}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryCalculator;
