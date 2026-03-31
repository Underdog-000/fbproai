import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import axios from 'axios'

// Компоненты
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Campaigns from './pages/Campaigns'
import Rules from './pages/Rules'
import AI from './pages/AI'
import Settings from './pages/Settings'
import Login from './pages/Login'

// Типы 
interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
}

// API клиент
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor для добавления токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Контекст аутентификации
export const AuthContext = React.createContext<{
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
})

// Контекст API
export const ApiContext = React.createContext<typeof api>(api)

// Главный layout с сайдбаром
function AppLayout() {
  const location = useLocation()
  const { isAuthenticated, logout } = React.useContext(AuthContext)
  
  // Проверяем токен из URL (после OAuth)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    
    if (token) {
      localStorage.setItem('token', token)
      // Очищаем URL от токена
      window.history.replaceState({}, '', location.pathname)
      // Перезагружаем страницу для инициализации
      window.location.reload()
    }
  }, [location])
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar onLogout={logout} />
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/ai" element={<AI />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// Главный компонент приложения
function App() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  
  // Проверяем аутентификацию при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await api.get('/auth/me')
          setUser(response.data.user)
        } catch (error) {
          console.error('Auth check failed:', error)
          localStorage.removeItem('token')
          setToken(null)
        }
      }
      setLoading(false)
    }
    
    checkAuth()
  }, [token])
  
  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }
  
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user }}>
      <ApiContext.Provider value={api}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </ApiContext.Provider>
    </AuthContext.Provider>
  )
}

export default App
