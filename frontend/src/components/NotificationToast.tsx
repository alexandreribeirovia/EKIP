import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface NotificationToastProps {
  type: 'success' | 'error'
  message: string
  onClose: () => void
}

const NotificationToast = ({ type, message, onClose }: NotificationToastProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(100)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const startTimers = useCallback(() => {
    clearTimers()
    const remainingTime = (progress / 100) * 10000
    
    timeoutRef.current = setTimeout(() => {
      onClose()
    }, remainingTime)
    
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => Math.max(prev - 1, 0))
    }, 100)
  }, [progress, onClose, clearTimers])

  useEffect(() => {
    if (!isHovered) {
      startTimers()
    } else {
      clearTimers()
    }
    return () => clearTimers()
  }, [isHovered, startTimers, clearTimers])

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 9999, pointerEvents: 'auto' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <XCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90 whitespace-pre-line">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className={`ml-2 p-1 rounded-full transition-colors ${
            type === 'success' 
              ? 'text-green-400 hover:text-green-600 hover:bg-green-200' 
              : 'text-red-400 hover:text-red-600 hover:bg-red-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return createPortal(toastContent, document.body)
}

export default NotificationToast
