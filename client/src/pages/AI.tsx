import { Link } from 'react-router-dom'
import React, { useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Brain, 
  Loader2, 
  Sparkles, 
  CheckCircle, 
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { ApiContext } from '../App'

const AI: React.FC = () => {
  const api = useContext(ApiContext)
  
  // Запрос списка аккаунтов
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })
  
  // Запрос AI рекомендаций для первого аккаунта
  const accountId = accountsData?.accounts?.[0]?.accountId
  const { data: recommendationsData, isLoading, refetch } = useQuery({
    queryKey: ['ai-recommendations', accountId],
    queryFn: async () => {
      if (!accountId) return null
      const response = await api.get(`/accounts/${accountId}`)
      return response.data
    },
    enabled: !!accountId,
  })
  
  const recommendations = recommendationsData?.account?.aiRecommendations || []
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI-режим</h1>
          <p className="text-gray-600 mt-1">Искусственный интеллект для управления рекламой</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="btn-secondary flex items-center space-x-2"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Обновить</span>
        </button>
      </div>
      
      {/* Информация об аккаунте */}
      {!accountId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Сначала подключите рекламный аккаунт Facebook на странице{' '}
            <Link to="/accounts" className="font-medium underline">Аккаунты</Link>
          </p>
        </div>
      )}
      
      {/* Режимы работы AI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-500">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Режим рекомендаций</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Активен</span>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            AI анализирует данные и предлагает рекомендации. Вы принимаете решение.
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li>• Анализ эффективности кампаний</li>
            <li>• Предложения по оптимизации бюджета</li>
            <li>• Рекомендации по ставкам</li>
            <li>• Выявление проблемных объявлений</li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200 opacity-60">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-gray-100 p-3 rounded-lg">
              <Sparkles className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Полное управление</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Скоро</span>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            AI полностью управляет рекламой с вашими ограничениями.
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li>• Автоматическое управление ставками</li>
            <li>• Пауза/включение объявлений</li>
            <li>• Перераспределение бюджета</li>
            <li>• Safeguard-механизмы</li>
          </ul>
        </div>
      </div>
      
      {/* Рекомендации */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет рекомендаций</h3>
          <p className="text-gray-500">
            {accountId 
              ? 'AI пока не сгенерировал рекомендаций. Они появятся после анализа данных.' 
              : 'Подключите аккаунт для получения AI-рекомендаций'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Последние рекомендации</h3>
          {recommendations.map((rec: any) => (
            <div key={rec.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${
                    rec.isAccepted === true ? 'bg-green-100' :
                    rec.isAccepted === false ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    {rec.isAccepted === true ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : rec.isAccepted === false ? (
                      <XCircle className="h-6 w-6 text-red-600" />
                    ) : (
                      <Clock className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{rec.entityName}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Тип: {rec.entityType} | Действие: {rec.recommendationType}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">{rec.details}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-gray-500">
                        Уверенность: {Math.round(rec.confidence * 100)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(rec.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>
                </div>
                
                {rec.isAccepted === null && (
                  <div className="flex items-center space-x-2">
                    <button className="btn-primary text-sm">
                      Принять
                    </button>
                    <button className="btn-secondary text-sm">
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Safeguard-и */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Safeguard-механизмы</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900">Лимиты на действия</h4>
            <ul className="text-sm text-gray-500 mt-2 space-y-1">
              <li>• Макс. изменение бюджета: 30%/день</li>
              <li>• Макс. пауз: 10/день</li>
              <li>• Мин. ROI порог: -50%</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900">Проверки</h4>
            <ul className="text-sm text-gray-500 mt-2 space-y-1">
              <li>• Проверка дневного лимита</li>
              <li>• Проверка бизнес-часов</li>
              <li>• Проверка confidence {'>'} 0.8</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Информация */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• AI анализ запускается каждые 2 часа</li>
          <li>• Используется модель Claude через OpenRouter</li>
          <li>• Все рекомендации логируются</li>
          <li>• Режим полного управления будет доступен в v2</li>
        </ul>
      </div>
    </div>
  )
}

export default AI
