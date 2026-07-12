import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdvancedSearch from './AdvancedSearch'
import { LanguageProvider } from '@/contexts/LanguageContext'

// Mock fetch to simulate backend API
global.fetch = jest.fn()

describe('AdvancedSearch Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1'
  })

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<LanguageProvider>{component}</LanguageProvider>)
  }

  it('successfully searches and displays results from backend', async () => {
    const mockResponse = {
      data: [
        {
          id: '1',
          title: 'React Developer',
          entityType: 'FREELANCER',
          location: 'Addis Ababa',
          rating: 4.5,
          description: 'Experienced React developer',
          skills: ['React', 'TypeScript'],
          price: 1000,
          currency: 'ETB',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    }

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    renderWithProvider(<AdvancedSearch />)

    const searchInput = screen.getByPlaceholderText(/search for/i)
    const searchButton = screen.getByText(/search/i)

    fireEvent.change(searchInput, { target: { value: 'React' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('keyword=React'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'en',
          }),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('React Developer')).toBeInTheDocument()
      expect(screen.getByText('Addis Ababa')).toBeInTheDocument()
      expect(screen.getByText('4.5')).toBeInTheDocument()
    })
  })

  it('sends correct Accept-Language header for Amharic', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    })

    const { getByText } = renderWithProvider(<AdvancedSearch />)

    // Switch to Amharic
    const languageButton = getByText('አማ')
    fireEvent.click(languageButton)

    const searchButton = getByText(/ፈልግ/i)
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'am',
          }),
        })
      )
    })
  })

  it('handles backend validation errors correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        message: ['Minimum price must be less than or equal to maximum price'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    })

    renderWithProvider(<AdvancedSearch />)

    const searchButton = screen.getByText(/search/i)
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to perform search/i)).toBeInTheDocument()
    })
  })

  it('sends all filter parameters to backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    })

    renderWithProvider(<AdvancedSearch />)

    // Open filters
    const filtersButton = screen.getByText(/filters/i)
    fireEvent.click(filtersButton)

    // Set filters
    const entityTypeSelect = screen.getByLabelText(/entity type/i)
    fireEvent.change(entityTypeSelect, { target: { value: 'FREELANCER' } })

    const minPriceInput = screen.getByPlaceholderText('0')
    fireEvent.change(minPriceInput, { target: { value: '100' } })

    const maxPriceInput = screen.getByPlaceholderText('10000000')
    fireEvent.change(maxPriceInput, { target: { value: '500' } })

    const searchButton = screen.getByText(/search/i)
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('entityType=FREELANCER'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'en',
          }),
        })
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('minPrice=100'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxPrice=500'),
        expect.any(Object)
      )
    })
  })

  it('handles backend service unavailable error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        message: 'Search service temporarily unavailable',
        error: 'Service Unavailable',
        statusCode: 503,
      }),
    })

    renderWithProvider(<AdvancedSearch />)

    const searchButton = screen.getByText(/search/i)
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to perform search/i)).toBeInTheDocument()
    })
  })
})
