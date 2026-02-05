import dotenv from 'dotenv'

// Carregar variáveis de ambiente ANTES de tudo
dotenv.config()

import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { errorHandler } from './middleware/errorHandler'
import { notFound } from './middleware/notFound'
import { socketAuthMiddleware, initializeNotificationSocket } from './websocket'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import projectRoutes from './routes/projects'
import allocationRoutes from './routes/allocations'
import employeeRoutes from './routes/employees'
import employeeDetailRoutes from './routes/employeeDetail'
import dashboardRoutes from './routes/dashboard'
import domainsRoutes from './routes/domains'
import evaluationsRoutes from './routes/evaluations'
import lookupsRoutes from './routes/lookups'
import employeeEvaluationsRoutes from './routes/employeeEvaluations'
import evaluationAcceptRoutes from './routes/evaluationAccept'
import feedbackAcceptRoutes from './routes/feedbackAccept'
import feedbacksRoutes from './routes/feedbacks'
import pdiRoutes from './routes/pdi'
import notificationsRoutes from './routes/notifications'
import quizRoutes from './routes/quiz'
import quizParticipantsRoutes from './routes/quizParticipants'
import quizAnswerRoutes from './routes/quizAnswer'
import accessProfilesRoutes from './routes/accessProfiles'

const app = express()
const httpServer = createServer(app)
const PORT = process.env['PORT'] || 5000

// Configurar Socket.IO com CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
})

// Aplicar middleware de autenticação no Socket.IO
io.use(socketAuthMiddleware)

// Inicializar serviço de notificações WebSocket
initializeNotificationSocket(io)

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EKIP API',
      version: '1.0.0',
      description: 'API para o sistema EKIT - Enterprise Knowledge for Implementation & Projects',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
}

const specs = swaggerJsdoc(swaggerOptions)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
})

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500, // begin adding 500ms of delay per request above 50
})

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  credentials: true,
}))
app.use(compression())
// @ts-expect-error - Conflito de tipos entre versões de @types/express
app.use(cookieParser())
app.use(morgan('combined'))
app.use(limiter)
app.use(speedLimiter)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development'
  })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/allocations', allocationRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/employee-detail', employeeDetailRoutes) // Rotas de detalhes do funcionário
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/domains', domainsRoutes)
app.use('/api/evaluations', evaluationsRoutes) // Modelos de avaliação
app.use('/api/lookups', lookupsRoutes) // Lookups centralizados
app.use('/api/employee-evaluations', employeeEvaluationsRoutes) // Avaliações de funcionários
app.use('/api/evaluation-accept', evaluationAcceptRoutes) // Aceite de avaliações (rotas públicas e autenticadas)
app.use('/api/feedback-accept', feedbackAcceptRoutes) // Aceite de feedbacks (rotas públicas e autenticadas)
app.use('/api/feedbacks', feedbacksRoutes) // Feedbacks de consultores
app.use('/api/pdi', pdiRoutes) // PDI de consultores
app.use('/api/notifications', notificationsRoutes) // Notificações
app.use('/api/quiz', quizRoutes) // Quiz - CRUD de quizzes, perguntas e opções
app.use('/api/quiz-participants', quizParticipantsRoutes) // Participantes do Quiz
app.use('/api/quiz-answer', quizAnswerRoutes) // Resposta do Quiz (rotas públicas e autenticadas)
app.use('/api/access-profiles', accessProfilesRoutes) // Perfis de Acesso e Permissões

// Error handling
app.use(notFound)
app.use(errorHandler)

// Start server (HTTP + WebSocket)
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`)
  console.log(`🔔 WebSocket: ws://localhost:${PORT}`)
})

export { app, io, httpServer } 