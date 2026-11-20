'use client';

import React, { useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ExperienceLevel } from '../dto/salary-prediction.dto';

interface BatchPredictionRequest {
  predictions: Array<{
    jobTitle: string;
    location: string;
    experienceLevel: ExperienceLevel;
    industry?: string;
    currency?: string;
  }>;
}

interface BatchPredictionResponse {
  predictions: Array<{
    id: string;
    jobTitle: string;
    location: string;
    averageSalary: number;
    currency: string;
  }>;
  successCount: number;
  failureCount: number;
  processedAt: Date;
}

/**
 * BatchSalaryCalculator - React component for batch salary predictions
 *
 * Features:
 * - Predict up to 50 salaries at once
 * - Dynamic form fields for adding/removing predictions
 * - Batch processing optimization
 * - Results table with export functionality
 */
export const BatchSalaryCalculator: React.FC = () => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isLoading },
  } = useForm<BatchPredictionRequest>({
    defaultValues: {
      predictions: [
        {
          jobTitle: '',
          location: 'Addis Ababa',
          experienceLevel: ExperienceLevel.MID,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'predictions',
  });

  const [results, setResults] = useState<BatchPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: BatchPredictionRequest) => {
    if (data.predictions.length > 50) {
      setError('Maximum 50 predictions per batch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/salary/predict-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Batch prediction failed');
      }

      const result = await response.json();
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('salary.batch.title', 'Batch Salary Prediction')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('salary.batch.description', 'Predict salaries for multiple positions at once')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-lg p-8">
              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Dynamic Fields */}
              <div className="space-y-6 mb-8">
                {fields.map((field, index) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-700">Position {index + 1}</h3>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Job Title */}
                      <Controller
                        name={`predictions.${index}.jobTitle`}
                        control={control}
                        rules={{ required: 'Job title required' }}
                        render={({ field, fieldState: { error: fieldError } }) => (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Job Title
                            </label>
                            <input
                              {...field}
                              type="text"
                              placeholder="e.g., Developer"
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                                fieldError ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {fieldError && (
                              <p className="text-red-500 text-xs mt-1">{fieldError.message}</p>
                            )}
                          </div>
                        )}
                      />

                      {/* Location */}
                      <Controller
                        name={`predictions.${index}.location`}
                        control={control}
                        render={({ field }) => (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Location
                            </label>
                            <select
                              {...field}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="Addis Ababa">Addis Ababa</option>
                              <option value="Dire Dawa">Dire Dawa</option>
                              <option value="Hawassa">Hawassa</option>
                            </select>
                          </div>
                        )}
                      />

                      {/* Experience Level */}
                      <Controller
                        name={`predictions.${index}.experienceLevel`}
                        control={control}
                        render={({ field }) => (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Experience
                            </label>
                            <select
                              {...field}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value={ExperienceLevel.JUNIOR}>Junior</option>
                              <option value={ExperienceLevel.MID}>Mid</option>
                              <option value={ExperienceLevel.SENIOR}>Senior</option>
                              <option value={ExperienceLevel.LEAD}>Lead</option>
                            </select>
                          </div>
                        )}
                      />

                      {/* Industry */}
                      <Controller
                        name={`predictions.${index}.industry`}
                        control={control}
                        render={({ field }) => (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Industry
                            </label>
                            <select
                              {...field}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="Technology">Technology</option>
                              <option value="Finance">Finance</option>
                              <option value="Healthcare">Healthcare</option>
                              <option value="Education">Education</option>
                            </select>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add More Button */}
              <button
                type="button"
                onClick={() =>
                  append({
                    jobTitle: '',
                    location: 'Addis Ababa',
                    experienceLevel: ExperienceLevel.MID,
                  })
                }
                disabled={fields.length >= 50}
                className="mb-6 w-full py-2 px-4 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 font-semibold hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Another Position ({fields.length}/50)
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {loading ? 'Processing...' : 'Predict All Salaries'}
              </button>
            </form>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow-lg p-8 h-fit">
            {!results ? (
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-4">📋 No results yet</p>
                <p className="text-sm text-gray-400">
                  Submit the form to see batch prediction results
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Results</h2>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs text-gray-600">Success</p>
                    <p className="text-3xl font-bold text-green-700">{results.successCount}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-xs text-gray-600">Failed</p>
                    <p className="text-3xl font-bold text-red-700">{results.failureCount}</p>
                  </div>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left py-2">Position</th>
                        <th className="text-right py-2">Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.predictions.map((prediction, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-medium">{prediction.jobTitle}</td>
                          <td className="text-right font-semibold text-green-700">
                            {prediction.averageSalary.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchSalaryCalculator;
