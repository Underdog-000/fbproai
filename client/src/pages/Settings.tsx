import React, { useContext } from 'react'
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Database,
  Key,
  LogOut
} from 'lucide-react'
import { AuthContext } from '../App'

const Settings: React.FC = () => {
  const { user, logout } = useContext(AuthContext)
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-600 mt-1">Управление аккаунтом и приложением</p>
      </div>
      
      {/* Профиль */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-blue-100 p-4 rounded-full">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Профиль</h2>
            <p className="text-gray-500">Информация об аккаунте</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={user?.email || ''} 
              className="input-field" 
              disabled 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
            <input 
              type="text" 
              value={user?.name || ''} 
              className="input-field" 
              placeholder="Введите имя"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата регистрации</label>
            <input 
              type="text" 
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : ''} 
              className="input-field" 
              disabled 
            />
          </div>
        </div>
        
        <div className="mt-6">
          <button className="btn-primary">Сохранить изменения</button>
        </div>
      </div>
      
      {/* Уведомления */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-yellow-100 p-4 rounded-full">
            <Bell className="h-8 w-8 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Уведомления</h2>
            <p className="text-gray-500">Настройка оповещений</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Email уведомления</p>
              <p className="text-sm text-gray-500">Получать уведомления на email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Уведомления о правилах</p>
              <p className="text-sm text-gray-500">Когда правила выполняют действия</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">AI рекомендации</p>
              <p className="text-sm text-gray-500">Новые рекомендации от AI</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
      
      {/* Безопасность */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-green-100 p-4 rounded-full">
            <Shield className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Безопасность</h2>
            <p className="text-gray-500">Пароль и аутентификация</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <button className="btn-secondary w-full">
            <Key className="h-4 w-4 mr-2" />
            Изменить пароль
          </button>
          <button className="btn-secondary w-full">
            <Shield className="h-4 w-4 mr-2" />
            Двухфакторная аутентификация
          </button>
        </div>
      </div>
      
      {/* Данные */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-purple-100 p-4 rounded-full">
            <Database className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Данные</h2>
            <p className="text-gray-500">Экспорт и управление данными</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <button className="btn-secondary w-full">
            Экспорт данных
          </button>
          <button className="btn-secondary w-full">
            Очистить кэш
          </button>
        </div>
      </div>
      
      {/* Выход */}
      <div className="bg-white rounded-lg shadow p-6">
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          <LogOut className="h-5 w-5" />
          <span>Выйти из аккаунта</span>
        </button>
      </div>
      
      {/* Информация о версии */}
      <div className="text-center text-sm text-gray-500">
        <p>Facebook Ad Manager v1.0.0</p>
        <p>© 2024 Все права защищены</p>
      </div>
    </div>
  )
}

export default Settings