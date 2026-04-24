import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WizardPage } from './pages/WizardPage'
import { SubmittedPage } from './pages/SubmittedPage'
import { InvalidPage } from './pages/InvalidPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WizardPage />} />
        <Route path="/submitted" element={<SubmittedPage />} />
        <Route path="/invalid" element={<InvalidPage />} />
      </Routes>
    </BrowserRouter>
  )
}
