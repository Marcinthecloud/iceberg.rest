import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ApiMonitor } from '@/components/ApiMonitor'

export function MainLayout() {
  return (
    <div className="flex h-screen bg-background">
      <ApiMonitor />
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
