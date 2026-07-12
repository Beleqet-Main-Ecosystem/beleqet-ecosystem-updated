import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdvancedSearch from './AdvancedSearch'
import { LanguageProvider } from '@/contexts/LanguageContext'

global.fetch = jest.fn()

describe('AdvancedSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<LanguageProvider>{component}</LanguageProvider>)
  }

  it('renders search input and button', () => {
    renderWithProvider(<AdvancedSearch />)
    
    const searchInput = screen.getByPlaceholderText(/search for/i)
    const searchButton = screen.getByText(/search/i)
    
    expect(searchInput).toBeInTheDocument()
    expect(searchButton).toBeInTheDocument()
  })

  it('toggles filters panel when filters button is clicked', () => {
    renderWithProvider(<AdvancedSearch />)
    
    const filtersButton = screen.getByText(/filters/i)
    fireEvent.click(filtersButton)
    
    expect(screen.getByText(/entity type/i)).toBeInTheDocument()
  })

  it('calls search API with correct parameters', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    renderWithProvider(<AdvancedSearch />)
    
    const searchInput = screen.getByPlaceholderText(/search for/i)
    const searchButton = screen.getByText(/search/i)
    
    fireEvent.change(searchInput, { target: { value: 'React Developer' } })
    fireEvent.click(searchButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('keyword=React+Developer'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'en',
          }),
        })
      )
    })
  })

  it('displays error message when search fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    renderWithProvider(<AdvancedSearch />)
    
    const searchButton = screen.getByText(/search/i)
    fireEvent.click(searchButton)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to perform search/i)).toBeInTheDocument()
    })
  })

  it('clears filters when clear button is clicked', () => {
    renderWithProvider(<AdvancedSearch />)
    
    const filtersButton = screen.getByText(/filters/i)
    fireEvent.click(filtersButton)
    
    const clearButton = screen.getByText(/clear all/i)
    fireEvent.click(clearButton)
    
    expect(screen.getByText(/entity type/i)).toBeInTheDocument()
  })
})
