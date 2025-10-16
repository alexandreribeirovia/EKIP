import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import logo from '../../img/logo.png'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simular login
    setTimeout(() => {
      login(
        {
          id: '1',
          runrun_user_id: 'alexandre-ribeiro',
          name: 'Alexandre Ribeiro',
          email: email,
          role: 'admin',
          avatar:'https://d22iebrrkdwkpr.cloudfront.net/avatars/sua-empresa--10340/alexandre-ribeiro/4ff87741f952d96b104266f09425d9f3regular.jpg'
          // avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
        },
        'fake-jwt-token'
      )
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Card flutuante com sombra */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Seção superior com logo */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center">
            <div className="mx-auto h-20 w-20 mb-4 flex items-center justify-center">
              <img src={logo} alt="EKIP Logo" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Bem-vindo ao EKIP
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Faça login para acessar a plataforma!
            </p>
          </div>

          {/* Formulário */}
          <form className="px-8 py-8 space-y-6 pb-20" onSubmit={handleSubmit}>
            {/* Campo Email */}
            <div>
              {/* <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label> */}
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              {/* <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Senha
              </label> */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-orange-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:opacity-70 transition-opacity"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            

            {/* Botão Login */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Entrando...
                  </span>
                ) : 'LOGIN'}
              </button>
            </div>
              {/* Link Esqueceu senha */}
            {/* <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div> */}
            {/* Separador */}
            {/* <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  OU
                </span>
              </div>
            </div> */}

            {/* Link Cadastro */}
            {/* <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  className="font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                >
                  Cadastre-se
                </button>
              </p>
            </div> */}
          </form>

          {/* Rodapé laranja */}
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

export default Login 