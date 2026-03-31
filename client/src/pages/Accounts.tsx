import React, { useContext, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Facebook, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { ApiContext, AuthContext } from '../App'

const Accounts: React.FC = () => {
  const api = useContext(ApiContext)
  const { user } = useContext(AuthContext)
  const queryClient = useQueryClient()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  
  // Запрос списка аккаунтов
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })
  
  // Мутация для синхронизации
  const syncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await api.post(`/accounts/${accountId}/sync`)
      return response.data
    },
    onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  setSyncingId(null)
  alert('Синхронизация завершена')
},
    onError: (error: any) => {
  setSyncingId(null)
  const message =
    error?.response?.data?.message ||
    error?.message ||
    'Ошибка синхронизации'
  alert(message)
},
  })
  
  // Мутация для удаления
  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await api.delete(`/accounts/${accountId}`)
      return response.data
    },
    onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  setSyncingId(null)
  alert('Удалено')
},
  })
  
  // Facebook OAuth
  const handleConnectFacebook = async () => {
    try {
      const response = await api.get(`/auth/facebook?userId=${user?.id}`)
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('Failed to get Facebook auth URL:', error)
    }
  }
  
  // Синхронизация аккаунта
  const handleSync = (accountId: string) => {
    setSyncingId(accountId)
    syncMutation.mutate(accountId)
  }
  
  // Удаление аккаунта
  const handleDelete = (accountId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      deleteMutation.mutate(accountId)
    }
  }
  
  const accounts = data?.accounts || []
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аккаунты</h1>
          <p className="text-gray-600 mt-1">Управление рекламными аккаунтами Facebook</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => refetch()}
            className="btn-secondary flex items-center space-x-2"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <button 
            onClick={handleConnectFacebook}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Подключить Facebook</span>
          </button>
        </div>
      </div>
      
      {/* Список аккаунтов */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Facebook className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет подключенных аккаунтов</h3>
          <p className="text-gray-500 mb-6">
            Подключите ваш Facebook рекламный аккаунт для начала работы
          </p>
          <button 
            onClick={handleConnectFacebook}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Facebook className="h-5 w-5" />
            <span>Подключить Facebook</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account: any) => (
            <div key={account.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Facebook className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">ID: {account.accountId}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>Часовой пояс: {account.timezone}</span>
                      </div>
                      <div className={`flex items-center text-sm ${
                        account.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {account.status === 'active' ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <AlertCircle className="h-4 w-4 mr-1" />
                        )}
                        <span>{account.status === 'active' ? 'Активен' : 'Истек токен'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>{account._count.campaigns} кампаний</span>
                      <span>{account._count.rules} правил</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSync(account.accountId)}
                    disabled={syncingId === account.accountId}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    {syncingId === account.accountId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>Синхронизировать</span>
                  </button>
                  <button
                    onClick={() => handleDelete(account.accountId)}
                    disabled={deleteMutation.isPending}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
              
              {/* Информация о токене */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Токен действителен до:</span>
                  <span className={`font-medium ${
                    new Date(account.tokenExpiresAt) < new Date() 
                      ? 'text-red-600' 
                      : 'text-gray-900'
                  }`}>
                    {new Date(account.tokenExpiresAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                {new Date(account.tokenExpiresAt) < new Date() && (
                  <p className="text-red-600 text-sm mt-2">
                    ⚠️ Токен истек. Пожалуйста, переподключите аккаунт.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Информация */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Данные синхронизируются автоматически каждые 6 часов</li>
          <li>• Токены Facebook действительны 60 дней</li>
          <li>• При истечении токена потребуется переподключение</li>
        </ul>
      </div>
    </div>
  )
}

export default Accounts
