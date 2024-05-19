import './App.css'
import { AppStateContext } from './State'
import type { AppState } from './State'
import InterpretPage from './InterpretPage'
import ComposePage from './ComposePage'
import { useState } from 'react'

function renderPage(appState: AppState["page"]) {
  switch (appState.id) {
    case 'interpret':
      return <InterpretPage />
    case 'compose':
      return <ComposePage pageData={appState.data} />
  }
}

function App() {
  const [page, setPage] = useState<AppState["page"]>({
    id: 'interpret',
    data: {}
  })

  return <AppStateContext.Provider
    value={{
      page,
      setPage
    }}>
    {renderPage(page)}
  </AppStateContext.Provider>
}

export default App
