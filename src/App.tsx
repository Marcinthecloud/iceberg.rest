import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CatalogProvider } from './lib/context/CatalogContext'
import { MainLayout } from './components/layout/MainLayout'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })))
const TablePage = lazy(() => import('./pages/TablePage').then(m => ({ default: m.TablePage })))

// Simple loading component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <CatalogProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          {/* Nested routes with shared MainLayout (sidebar persists) */}
          <Route element={<MainLayout />}>
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/table/:namespace/:table" element={<TablePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </CatalogProvider>
  )
}

export default App
