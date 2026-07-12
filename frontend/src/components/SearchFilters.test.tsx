import { render, screen, fireEvent } from '@testing-library/react'
import SearchFilters from './SearchFilters'
import { LanguageProvider } from '@/contexts/LanguageContext'

describe('SearchFilters', () => {
  const mockFilters = {
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
  }

  const mockSetFilters = jest.fn()
  const mockOnClear = jest.fn()

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<LanguageProvider>{component}</LanguageProvider>)
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all filter options', () => {
    renderWithProvider(
      <SearchFilters
        filters={mockFilters}
        setFilters={mockSetFilters}
        onClear={mockOnClear}
      />
    )

    expect(screen.getByText(/entity type/i)).toBeInTheDocument()
    expect(screen.getByText(/currency/i)).toBeInTheDocument()
    expect(screen.getByText(/location/i)).toBeInTheDocument()
    expect(screen.getByText(/min price/i)).toBeInTheDocument()
    expect(screen.getByText(/max price/i)).toBeInTheDocument()
    expect(screen.getByText(/min rating/i)).toBeInTheDocument()
    expect(screen.getByText(/sort by/i)).toBeInTheDocument()
    expect(screen.getByText(/skills/i)).toBeInTheDocument()
  })

  it('calls setFilters when entity type is changed', () => {
    renderWithProvider(
      <SearchFilters
        filters={mockFilters}
        setFilters={mockSetFilters}
        onClear={mockOnClear}
      />
    )

    const entityTypeSelect = screen.getByLabelText(/entity type/i)
    fireEvent.change(entityTypeSelect, { target: { value: 'FREELANCER' } })

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'FREELANCER' })
    )
  })

  it('toggles skill when skill button is clicked', () => {
    renderWithProvider(
      <SearchFilters
        filters={mockFilters}
        setFilters={mockSetFilters}
        onClear={mockOnClear}
      />
    )

    const reactButton = screen.getByText('React')
    fireEvent.click(reactButton)

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ skills: ['React'] })
    )
  })

  it('calls onClear when clear button is clicked', () => {
    renderWithProvider(
      <SearchFilters
        filters={mockFilters}
        setFilters={mockSetFilters}
        onClear={mockOnClear}
      />
    )

    const clearButton = screen.getByText(/clear all/i)
    fireEvent.click(clearButton)

    expect(mockOnClear).toHaveBeenCalled()
  })
})
