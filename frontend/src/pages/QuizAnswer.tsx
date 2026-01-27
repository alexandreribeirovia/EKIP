/**
 * QuizAnswer - Página pública para responder quiz
 * 
 * Acesso via link temporário com token
 * Exibe perguntas e permite respostas
 * Mostra resultado com animações de celebração
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  Award,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  RefreshCw,
  HelpCircle,
  Lightbulb,
  Trophy,
  Frown,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  QuizAnswerSession,
  QuizSubmitResponse,
  QuizAnswerResult,
} from '../types';

// Logos
import logoWhite from '../../img/logo_white.png';
import logo from '../../img/logo.png';

// API base URL para chamadas públicas (sem auth)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-6 px-4 sm:px-6 lg:px-8">
    <div className="w-full max-w-lg">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header com Logo */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
            <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bem vindo ao EKIP</h2>
        </div>
        {/* Content */}
        <div className="p-8 flex flex-col items-center">
          <RefreshCw className="w-12 h-12 animate-spin text-orange-500 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Carregando quiz...</p>
        </div>
        {/* Footer */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
          <p className="text-sm text-white font-medium">Via Consulting</p>
        </div>
      </div>
    </div>
  </div>
);

const ErrorPage = ({ title, message }: { title: string; message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-6 px-4 sm:px-6 lg:px-8">
    <div className="w-full max-w-lg">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header com Logo */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
            <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">EKIP</h2>
        </div>
        {/* Content */}
        <div className="p-8 flex flex-col items-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">{message}</p>
        </div>
        {/* Footer */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
          <p className="text-sm text-white font-medium">Via Consulting</p>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const QuizAnswer = () => {
  const { token } = useParams<{ token: string }>();

  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [quizSession, setQuizSession] = useState<QuizAnswerSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number[]>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [startTime] = useState<Date>(new Date());

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const verifyAndLoadQuiz = useCallback(async () => {
    if (!token) {
      setError({ title: 'Token Inválido', message: 'O link de acesso é inválido ou está incompleto.' });
      setIsLoading(false);
      return;
    }

    try {
      // Verificar token e carregar dados do quiz
      const verifyResponse = await fetch(`${API_BASE_URL}/api/quiz-answer/verify/${token}`);
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        const errorMessage = verifyData.error?.message || 'Link inválido ou expirado';
        setError({ title: 'Acesso Negado', message: errorMessage });
        setIsLoading(false);
        return;
      }

      // Os dados do verify contêm tudo que precisamos (quiz, participant, attempts, questions)
      const sessionData = verifyData.data as QuizAnswerSession;

      // Iniciar/continuar tentativa
      const startResponse = await fetch(`${API_BASE_URL}/api/quiz-answer/start/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const startData = await startResponse.json();

      if (!startResponse.ok || !startData.success) {
        const errorMessage = startData.error?.message || 'Erro ao iniciar o quiz';
        setError({ title: 'Erro', message: errorMessage });
        setIsLoading(false);
        return;
      }

      // Mesclar dados do verify com attempt_id do start
      setQuizSession({
        ...sessionData,
        attempt_id: startData.data.attempt_id
      });
      setIsLoading(false);
    } catch (err) {
      console.error('Erro ao carregar quiz:', err);
      setError({ title: 'Erro de Conexão', message: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.' });
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void verifyAndLoadQuiz();
  }, [verifyAndLoadQuiz]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectOption = (questionId: number, optionId: number, questionType: 'single_choice' | 'multiple_choice') => {
    setAnswers(prev => {
      const newAnswers = new Map(prev);
      
      if (questionType === 'single_choice') {
        // Para escolha única, substitui a resposta
        newAnswers.set(questionId, [optionId]);
      } else {
        // Para múltipla escolha, toggle
        const currentAnswers = newAnswers.get(questionId) || [];
        if (currentAnswers.includes(optionId)) {
          newAnswers.set(questionId, currentAnswers.filter(id => id !== optionId));
        } else {
          newAnswers.set(questionId, [...currentAnswers, optionId]);
        }
      }
      
      return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    if (quizSession && currentQuestionIndex < quizSession.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowHint(false);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowHint(false);
    }
  };

  const handleSubmit = async () => {
    if (!token || !quizSession) return;

    // Verificar se a tentativa foi iniciada
    if (!quizSession.attempt_id) {
      alert('Erro: tentativa não iniciada. Por favor, recarregue a página.');
      return;
    }

    // Verificar se todas as perguntas foram respondidas
    const unansweredQuestions = quizSession.questions.filter(q => {
      const answer = answers.get(q.id);
      return !answer || answer.length === 0;
    });

    if (unansweredQuestions.length > 0) {
      alert(`Por favor, responda todas as perguntas. Faltam ${unansweredQuestions.length} pergunta(s).`);
      // Ir para a primeira pergunta não respondida
      const firstUnansweredIndex = quizSession.questions.findIndex(q => {
        const answer = answers.get(q.id);
        return !answer || answer.length === 0;
      });
      if (firstUnansweredIndex >= 0) {
        setCurrentQuestionIndex(firstUnansweredIndex);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Formatar respostas
      const formattedAnswers = quizSession.questions.map(q => ({
        question_id: q.id,
        selected_option_ids: answers.get(q.id) || [],
      }));

      // Calcular tempo gasto em segundos
      const timeSpentSeconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

      const response = await fetch(`${API_BASE_URL}/api/quiz-answer/submit/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          attempt_id: quizSession.attempt_id,
          answers: formattedAnswers,
          time_spent_seconds: timeSpentSeconds
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error?.message || 'Erro ao enviar respostas');
        setIsSubmitting(false);
        return;
      }

      setResult(data.data);

      // Animação baseada na nota
      const percentage = data.data.percentage;
      
      if (percentage >= 90) {
        // Confetti para notas >= 90%
        triggerConfetti();
      }
    } catch (err) {
      console.error('Erro ao enviar respostas:', err);
      alert('Erro ao enviar respostas. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 5000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti dos dois lados
      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
        colors: ['#FF6B35', '#F7C59F', '#004E89', '#1A659E', '#EFEFD0'],
      });

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
        colors: ['#FF6B35', '#F7C59F', '#004E89', '#1A659E', '#EFEFD0'],
      });
    }, 250);
  };

  const getProgressPercentage = () => {
    if (!quizSession) return 0;
    const answeredCount = Array.from(answers.values()).filter(a => a.length > 0).length;
    return Math.round((answeredCount / quizSession.questions.length) * 100);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorPage title={error.title} message={error.message} />;
  }

  if (!quizSession) {
    return <ErrorPage title="Erro" message="Não foi possível carregar o quiz." />;
  }

  if (!quizSession.questions || quizSession.questions.length === 0) {
    return <ErrorPage title="Quiz Vazio" message="Este quiz não possui perguntas cadastradas." />;
  }

  // ============================================================================
  // RENDER RESULT
  // ============================================================================

  if (result) {
    const percentage = result.percentage;
    const passed = result.passed;
    const isExcellent = percentage >= 90;
    const isFailed = percentage < 50;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Result Header */}
          <div className={`rounded-2xl overflow-hidden mb-6 text-center shadow-xl ${
            isExcellent 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
              : isFailed 
              ? 'bg-gradient-to-r from-red-500 to-orange-500'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
          } text-white`}>
            {/* Logo Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-black/10">
              <div className="flex flex-col items-center gap-1">
                <img src={logoWhite} alt="EKIP" className="h-10 w-10 object-contain" />
                <span className="text-white font-bold text-xs">EKIP</span>
              </div>
              <div className="flex-1">
                <h1 className="text-white text-xl font-bold">Resultado do Quiz</h1>
              </div>
            </div>
            {/* Score Content */}
            <div className="p-8">
            {/* Emoji/Icon */}
            <div className="mb-4">
              {isExcellent ? (
                <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-2">
                  <Trophy className="w-14 h-14" />
                </div>
              ) : isFailed ? (
                <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-2">
                  <Frown className="w-14 h-14" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-2">
                  <Award className="w-14 h-14" />
                </div>
              )}
            </div>

            {/* Message */}
            <h1 className="text-3xl font-bold mb-2">
              {isExcellent 
                ? '🎉 Parabéns! Excelente resultado!' 
                : isFailed 
                ? 'Não desanime! Você pode melhorar!'
                : passed 
                ? 'Muito bem! Você foi aprovado!'
                : 'Continue praticando!'
              }
            </h1>
            
            {isFailed && (
              <p className="text-white/90 text-lg mb-4">
                Cada erro é uma oportunidade de aprendizado. Revise o conteúdo e tente novamente! 💪
              </p>
            )}

            {/* Score Display */}
            <div className="text-6xl font-bold mb-2">
              {percentage}%
            </div>
            <div className="text-xl opacity-90">
              {result.score}/{result.total_points} pontos
            </div>
            <div className="text-lg opacity-80 mt-2">
              {result.correct_count} correta{result.correct_count !== 1 ? 's' : ''} de {result.total_questions} pergunta{result.total_questions !== 1 ? 's' : ''}
            </div>

            {result.pass_score && (
              <div className={`mt-4 px-4 py-2 rounded-full inline-block ${
                passed ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {passed ? '✓ Aprovado' : `✗ Nota mínima: ${result.pass_score}%`}
              </div>
            )}

            {result.time_spent_seconds && (
              <div className="mt-4 flex items-center justify-center gap-2 text-white/80">
                <Clock className="w-4 h-4" />
                Tempo: {formatTime(result.time_spent_seconds)}
              </div>
            )}
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Detalhes das Respostas
              </h2>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {result.results.map((questionResult, index) => (
                <QuestionResultCard key={questionResult.question_id} result={questionResult} index={index} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Obrigado por participar!</p>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl px-8 py-2 inline-block">
              <p className="text-sm text-white font-medium">Via Consulting</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER QUIZ
  // ============================================================================

  const currentQuestion = quizSession.questions[currentQuestionIndex];
  const currentAnswer = answers.get(currentQuestion.id) || [];
  const isLastQuestion = currentQuestionIndex === quizSession.questions.length - 1;
  const progress = getProgressPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Quiz Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-6">
          {/* Orange Header with Logo */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <img src={logoWhite} alt="EKIP" className="h-10 w-10 object-contain" />
              <span className="text-white font-bold text-xs">EKIP</span>
            </div>
            <div className="flex-1">
              <h1 className="text-white text-xl font-bold">
                {quizSession.quiz.title}
              </h1>
              {quizSession.quiz.description && (
                <p className="text-white/80 text-sm mt-1">
                  {quizSession.quiz.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Info and Progress Section */}
          <div className="p-6">
          {/* Info Bar */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-4 h-4" />
              {quizSession.quiz.total_questions} pergunta{quizSession.quiz.total_questions !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Award className="w-4 h-4" />
              {quizSession.quiz.total_points} ponto{quizSession.quiz.total_points !== 1 ? 's' : ''}
            </div>
            {quizSession.quiz.pass_score && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Nota mínima: {quizSession.quiz.pass_score}%
              </div>
            )}
            {quizSession.attempts.limit && (
              <div className="flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />
                Tentativa {quizSession.attempts.count + 1}/{quizSession.attempts.limit}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-6">
          {/* Question Header */}
          <div className="p-6 pt-2 pb-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-200">
                Pergunta {currentQuestionIndex + 1} de {quizSession.questions.length}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentQuestion.question_type === 'single_choice'
                  ? 'bg-white/20'
                  : 'bg-purple-500/50'
              }`}>
                {currentQuestion.question_type === 'single_choice' ? 'Escolha Única' : 'Múltipla Escolha'}
              </span>
            </div>
            <h2 className="text-xl font-semibold">
              {currentQuestion.question_text}
            </h2>
            <div className="mt-2 text-orange-200 text-sm">
              {currentQuestion.points} ponto{currentQuestion.points !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Options */}
          <div className="p-6 pb-2 space-y-3">
            {currentQuestion.question_type === 'multiple_choice' && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Selecione todas as opções corretas
              </p>
            )}

            {currentQuestion.options.map((option, optIndex) => {
              const isSelected = currentAnswer.includes(option.id);
              const letter = String.fromCharCode(65 + optIndex);

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(
                    currentQuestion.id, 
                    option.id, 
                    currentQuestion.question_type
                  )}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* Radio/Checkbox visual */}
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {isSelected ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {letter}
                      </span>
                    )}
                  </div>

                  {/* Option text */}
                  <span className={`flex-1 text-left ${
                    isSelected
                      ? 'text-orange-700 dark:text-orange-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {option.option_text}
                  </span>
                </button>
              );
            })}

            {/* Hint - após as opções */}
            {currentQuestion.hint && (
              <div className="pt-1 mt-2 ">
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  {showHint ? 'Ocultar dica' : 'Ver dica'}
                </button>
                {showHint && (
                  <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-orange-800 dark:text-orange-200">
                    💡 {currentQuestion.hint}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Footer */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
            <p className="text-sm text-white font-medium">Via Consulting</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              currentQuestionIndex === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Anterior
          </button>

          {/* Question dots */}
          <div className="flex items-center gap-1">
            {quizSession.questions.map((q, idx) => {
              const hasAnswer = (answers.get(q.id) || []).length > 0;
              const isCurrent = idx === currentQuestionIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setShowHint(false);
                  }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-orange-500 scale-125'
                      : hasAnswer
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={`Pergunta ${idx + 1}`}
                />
              );
            })}
          </div>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Finalizar Quiz
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-md"
            >
              Próxima
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// QUESTION RESULT CARD
// ============================================================================

const QuestionResultCard = ({ result, index }: { result: QuizAnswerResult; index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="p-4">
      {/* Question header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-3 text-left"
      >
        {/* Status icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          result.is_correct
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        }`}>
          {result.is_correct ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </div>

        {/* Question text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {index + 1}.
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              result.is_correct
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {result.points_earned}/{result.points} pt{result.points !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-gray-800 dark:text-gray-200 font-medium">
            {result.question_text}
          </p>
        </div>

        {/* Expand icon */}
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`} />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 ml-11 space-y-2">
          {result.options.map((option, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex);
            const showAsCorrect = option.is_correct;
            const showAsWrong = option.was_selected && !option.is_correct;
            const showAsMissed = option.is_correct && !option.was_selected;

            return (
              <div
                key={option.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  showAsCorrect && option.was_selected
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : showAsWrong
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : showAsMissed
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                  {letter}.
                </span>
                <div className="flex-1">
                  <p className={`text-sm ${
                    showAsCorrect
                      ? 'text-green-700 dark:text-green-300 font-medium'
                      : showAsWrong
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {option.option_text}
                    {option.was_selected && (
                      <span className="ml-2 text-xs">
                        {option.is_correct ? '✓ Sua resposta (correta)' : '✗ Sua resposta'}
                      </span>
                    )}
                    {showAsMissed && (
                      <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠ Resposta correta
                      </span>
                    )}
                  </p>
                  {option.rationale && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      {option.rationale}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {result.explanation && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Explicação:</strong> {result.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizAnswer;
