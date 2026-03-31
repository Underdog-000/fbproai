import React, { useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Settings, 
  Loader2, 
  Plus, 
  Play, 
  Pause, 
  Clock,
  Zap,
  RefreshCw
} from 'lucide-react'
import { ApiContext } from '../App'

const Rules: React.FC = () => {
  const api = useContext(ApiContext)
  
  // Запрос списка аккаунтов
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })
  
  // Запрос правил для первого аккаунта
  const accountId = accountsData?.accounts?.[0]?.accountId
  const { data: rulesData, isLoading, refetch } = useQuery({
    queryKey: ['rules', accountId],
    queryFn: async () => {
      if (!accountId) return null
      const response = await api.get(`/accounts/${accountId}`)
      return response.data
    },
    enabled: !!accountId,
  })
  
  const rules = rulesData?.account?.rules || []
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Правила</h1>
          <p className="text-gray-600 mt-1">Автоматизация управления рекламой</p>
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
          <button className="btn-primary flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Создать правило</span>
          </button>
        </div>
      </div>
      
      {/* Информация об аккаунте */}
      {!accountId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Сначала подключите рекламный аккаунт Facebook на странице{' '}
            <a href="/accounts" className="font-medium underline">Аккаунты</a>
          </p>
        </div>
      )}
      
      {/* Список правил */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет правил</h3>
          <p className="text-gray-500 mb-6">
            {accountId 
              ? 'Создайте правила для автоматического управления рекламой' 
              : 'Подключите аккаунт для создания правил'}
          </p>
          {accountId && (
            <button className="btn-primary inline-flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Создать правило</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule: any) => (
            <div key={rule.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${rule.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Zap className={`h-6 w-6 ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <Settings className="h-4 w-4 mr-1" />
                        <span>Сущность: {rule.entityType}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>Cooldown: {rule.cooldownMinutes} мин</span>
                      </div>
                      <div className={`flex items-center text-sm ${rule.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                        {rule.isActive ? (
                          <Play className="h-4 w-4 mr-1" />
                        ) : (
                          <Pause className="h-4 w-4 mr-1" />
                        )}
                        <span>{rule.isActive ? 'Активно' : 'Приостановлено'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="btn-secondary">
                    {rule.isActive ? 'Пауза' : 'Запустить'}
                  </button>
                  <button className="btn-secondary">
                    Редактировать
                  </button>
                </div>
              </div>
              
              {/* Условие и действие */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Условие</p>
                    <div className="bg-gray-50 rounded p-2 text-sm">
                      {JSON.parse(rule.condition).field} {JSON.parse(rule.condition).operator} {JSON.parse(rule.condition).value}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Действие</p>
                    <div className="bg-gray-50 rounded p-2 text-sm">
                      {rule.action}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Примеры правил */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Примеры правил</h3>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900">Выключить при CPL &gt; $10</h4>
            <p className="text-sm text-gray-500 mt-1">
              Автоматически приостанавливает объявление, если стоимость лида превышает $10
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Условие: CPL greater_than 10 | Действие: pause
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900">Выключить при spend &gt; $50 без лидов</h4>
            <p className="text-sm text-gray-500 mt-1">
              Приостанавливает объявление, если потрачено больше $50 и нет лидов
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Условие: spend greater_than 50 И leads equals 0 | Действие: pause
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900">Включить в 9:00 MSK</h4>
            <p className="text-sm text-gray-500 mt-1">
              Включает объявление в 9:00 по московскому времени
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Условие: time_of_day equals 09:00 | Действие: enable
            </div>
          </div>
        </div>
      </div>
      
      {/* Информация */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Правила проверяются каждые 30 минут</li>
          <li>• Cooldown защищает от слишком частых действий</li>
          <li>• Все действия логируются в истории выполнения</li>
          <li>• Можно применять к объявлениям, адсетам и кампаниям</li>
        </ul>
      </div>
    </div>
  )
}

export default Rules
