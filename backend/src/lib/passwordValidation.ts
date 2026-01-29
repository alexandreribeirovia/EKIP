/**
 * Password Validation - Validação de força de senha
 * 
 * Regras:
 * - Mínimo 8 caracteres
 * - Pelo menos 1 letra maiúscula
 * - Pelo menos 1 letra minúscula
 * - Pelo menos 1 número
 * - Pelo menos 1 símbolo especial
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
}

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
}

const MIN_PASSWORD_LENGTH = 8
const SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/

/**
 * Valida a força da senha
 * @param password - Senha a ser validada
 * @returns Resultado da validação com erros e nível de força
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []
  const requirements = checkPasswordRequirements(password)

  if (!requirements.minLength) {
    errors.push(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
  }

  if (!requirements.hasUppercase) {
    errors.push('A senha deve conter pelo menos 1 letra maiúscula')
  }

  if (!requirements.hasLowercase) {
    errors.push('A senha deve conter pelo menos 1 letra minúscula')
  }

  if (!requirements.hasNumber) {
    errors.push('A senha deve conter pelo menos 1 número')
  }

  if (!requirements.hasSymbol) {
    errors.push('A senha deve conter pelo menos 1 símbolo especial (!@#$%^&*...)')
  }

  // Calcular força da senha
  const passedRequirements = Object.values(requirements).filter(Boolean).length
  let strength: 'weak' | 'medium' | 'strong' = 'weak'

  if (passedRequirements === 5 && password.length >= 12) {
    strength = 'strong'
  } else if (passedRequirements >= 4) {
    strength = 'medium'
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  }
}

/**
 * Verifica quais requisitos a senha atende
 * @param password - Senha a ser verificada
 * @returns Objeto com status de cada requisito
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: SYMBOL_REGEX.test(password),
  }
}

/**
 * Retorna mensagem formatada para exibição ao usuário
 * @param result - Resultado da validação
 * @returns Mensagem formatada
 */
export function formatValidationMessage(result: PasswordValidationResult): string {
  if (result.valid) {
    return 'Senha válida'
  }
  return result.errors.join('. ')
}

/**
 * Constantes exportadas para uso no frontend
 */
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: MIN_PASSWORD_LENGTH,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SYMBOL: true,
}
