import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    sessionStorage.clear()
    navigate('/')
  }

  return (
    <div className="w-20 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-8">
      {/* Logo */}
      <button
        onClick={() => navigate('/catalog')}
        className="w-14 h-14 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-md transition-[background-color,box-shadow] duration-200 group"
        title="Home"
        aria-label="Go to catalog home"
      >
        <img
          src="/logo.svg"
          alt="Iceberg.rest Logo"
          className="w-11 h-11 object-contain group-hover:scale-105 transition-transform duration-200"
        />
      </button>

      <div className="flex-1" />

      {/* Divider */}
      <div className="w-12 h-px bg-gray-200 mb-6" />

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-14 h-14 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-md transition-[color,background-color,box-shadow] duration-200 group"
        title="Logout"
        aria-label="Logout"
      >
        <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
      </button>
    </div>
  )
}
