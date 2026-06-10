import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '@/lib/settings'

// Render a component inside the providers screens rely on (router + settings).
// Auth is mocked per-test where needed.
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </SettingsProvider>,
  )
}
