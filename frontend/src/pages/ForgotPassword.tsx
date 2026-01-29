import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mail, AlertCircle, CheckCircle, Shield } from 'lucide-react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import logo from '../../img/logo.png'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    // Verificar CAPTCHA se configurado
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Por favor, complete a verificação de segurança.')
      setIsLoading(false)
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captchaToken || undefined,
    })

    setIsLoading(false)

    if (error) {
      // Mensagem genérica para evitar enumeração de usuários
      setError('Ocorreu um erro. Tente novamente.')
      // Resetar CAPTCHA após erro
      if (turnstileRef.current) {
        turnstileRef.current.reset()
      }
      setCaptchaToken(null)
    } else {
      setSuccess('Se o e-mail estiver correto, você receberá um link para redefinir sua senha em breve.')
      setEmail('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center">
            <div className="mx-auto h-20 w-20 mb-4 flex items-center justify-center">
              <img src={logo} alt="EKIP Logo" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Recuperar Senha
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Digite seu e-mail para receber o link de redefinição.
            </p>
          </div>

          <form className="px-8 py-8 space-y-6" onSubmit={handlePasswordReset}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{success}</p>
              </div>
            )}

            {!success && (
              <>
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-orange-500" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                {/* CAPTCHA Turnstile - sempre visível na recuperação de senha */}
                {TURNSTILE_SITE_KEY && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Shield className="w-4 h-4" />
                      <span>Verificação de segurança</span>
                    </div>
                    <div className="flex justify-center">
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={(token) => setCaptchaToken(token)}
                        onExpire={() => setCaptchaToken(null)}
                        onError={() => {
                          setCaptchaToken(null)
                          setError('Erro na verificação de segurança. Tente novamente.')
                        }}
                        options={{
                          theme: 'auto',
                          size: 'normal',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading || (TURNSTILE_SITE_KEY ? !captchaToken : false)}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando...
                      </span>
                    ) : 'RECUPERAR SENHA'}
                  </button>
                </div>
              </>
            )}
            
            <div className="text-center">
              <Link to="/login" className="text-sm text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors">
                Voltar para o login
              </Link>
            </div>
          </form>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
            <p className="text-sm text-white font-medium">
              Desenvolvido por Via Consulting
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
