import { render, screen } from '@testing-library/react'
import SearchResults from './SearchResults'
import { LanguageProvider } from '@/contexts/LanguageContext'

describe('SearchResults', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(<LanguageProvider>{component}</LanguageProvider>)
  }

  it('renders loading state', () => {
    renderWithProvider(<SearchResults results={[]} loading={true} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders no results message when results are empty', () => {
    renderWithProvider(<SearchResults results={[]} loading={false} />)
    
    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('renders results when data is provided', () => {
    const mockResults = [
      {
        title: 'React Developer',
        entityType: 'FREELANCER',
        location: 'Addis Ababa',
        rating: 4.5,
        description: 'Experienced React developer',
        skills: ['React', 'TypeScript'],
        price: 1000,
        currency: 'ETB',
        createdAt: '2024-01-01',
      },
    ]

    renderWithProvider(<SearchResults results={mockResults} loading={false} />)
    
    expect(screen.getByText('React Developer')).toBeInTheDocument()
    expect(screen.getByText('Addis Ababa')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('displays correct number of results', () => {
    const mockResults = [
      { title: 'Result 1' },
      { title: 'Result 2' },
      { title: 'Result 3' },
    ]

    renderWithProvider(<SearchResults results={mockResults} loading={false} />)
    
    expect(screen.getByText(/3 results found/i)).toBeInTheDocument()
  })

  it('renders skills badges', () => {
    const mockResults = [
      {
        title: 'Full Stack Developer',
        skills: ['React', 'Node.js', 'TypeScript', 'Python', 'Java', 'PHP'],
      },
    ]

    renderWithProvider(<SearchResults results={mockResults} loading={false} />)
    
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
    expect(screen.getByText(/\+1 more/i)).toBeInTheDocument()
  })
})
