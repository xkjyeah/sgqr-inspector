import './App.css'
import { AppStateContext } from './State'
import type { AppState } from './State'
import InterpretPage from './InterpretPage'
import ComposePage from './ComposePage'
import { useState } from 'react'

function renderPage(appState: AppState["page"]) {
  switch (appState.id) {
    case 'interpret':
      return <InterpretPage rawData={appState.data.rawData} />
    case 'compose':
      return <ComposePage pageData={appState.data} />
  }
}

function App() {
  const [page, setPage] = useState<AppState["page"]>({
    id: 'interpret',
    data: {
      rawData: import.meta.env.DEV ?
        '00020101021126810011SG.COM.NETS01231198500065G9912312359000211111687665000308687665019908B97B381427530008com.grab0132312d0578749b4d2e89009e362bc39d6f0201228460010com.myfave0128https://myfave.com/qr/ejwnr551800007SG.SGQR011219052700AB92020701.00010306408830040201050207060400000708201905275204000053037025802SG5902NA6009Singapore6304651B'
        : null
    }
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
