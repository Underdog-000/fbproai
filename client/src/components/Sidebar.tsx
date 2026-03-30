import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  Settings, 
  Brain, 
  LogOut,
  Facebook
} from 'lucide-react'

interface SidebarProps {
  onLogout: () => void
}

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { path: '/accounts', icon: Users, label: 'Аккаунты' },
  { path: '/campaigns', icon: Megaphone, label: 'Кампании' },
  { path: '/rules', icon: Settings, label: 'Правила' },
  { path: '/ai', icon: Brain, label: 'AI-режим' },
  { path: '/settings', icon: Settings, label: 'Настройки' },
]

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  return (
    <aside className="sidebar">
      {/* Логотип */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Facebook className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">FB Manager</h1>
            <p className="text-xs text-gray-400">Реклама под контролем</p>
          </div>
        </div>
      </div>
      
      {/* Навигация */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon className="h-5 w-5 mr-3" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Кнопка выхода */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLogout}
          className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar