import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import 'tippy.js/dist/tippy.css' // Import tippy CSS

import { SemanticService } from './services/semantic';

if (typeof window !== 'undefined') {
  (window as any).SemanticService = SemanticService;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
