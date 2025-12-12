/**
 * Módulo de Criptografia AES-256-GCM
 * 
 * Usado para criptografar/descriptografar tokens Supabase
 * armazenados na tabela sessions.
 * 
 * @module lib/encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Obtém a chave de criptografia do ambiente
 * @throws {Error} Se a chave não estiver configurada ou for inválida
 */
function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY']
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY não está configurada no ambiente')
  }
  
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)')
  }
  
  // Validar se é hex válido
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('ENCRYPTION_KEY deve conter apenas caracteres hexadecimais')
  }
  
  return Buffer.from(key, 'hex')
}

/**
 * Criptografa um texto usando AES-256-GCM
 * 
 * @param plaintext - Texto a ser criptografado
 * @returns String criptografada no formato: iv:authTag:ciphertext (hex)
 * 
 * @example
 * const encrypted = encrypt('meu-token-secreto')
 * // Retorna: "a1b2c3...:d4e5f6...:g7h8i9..."
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Texto para criptografar não pode ser vazio')
  }
  
  const key = getEncryptionKey()
  
  // Gerar IV aleatório para cada criptografia
  const iv = crypto.randomBytes(IV_LENGTH)
  
  // Criar cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  // Criptografar
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Obter tag de autenticação
  const authTag = cipher.getAuthTag()
  
  // Formato: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Descriptografa um texto criptografado com AES-256-GCM
 * 
 * @param encryptedData - String criptografada no formato: iv:authTag:ciphertext
 * @returns Texto original descriptografado
 * @throws {Error} Se os dados estiverem corrompidos ou a chave for inválida
 * 
 * @example
 * const decrypted = decrypt('a1b2c3...:d4e5f6...:g7h8i9...')
 * // Retorna: 'meu-token-secreto'
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Dados criptografados não podem ser vazios')
  }
  
  const parts = encryptedData.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Formato de dados criptografados inválido. Esperado: iv:authTag:ciphertext')
  }
  
  const ivHex = parts[0]!
  const authTagHex = parts[1]!
  const ciphertext = parts[2]!
  
  // Validar tamanhos
  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error('IV com tamanho inválido')
  }
  
  if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    throw new Error('AuthTag com tamanho inválido')
  }
  
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  // Criar decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  try {
    // Descriptografar
    let decrypted: string = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // Erro de autenticação (dados corrompidos ou chave errada)
    throw new Error('Falha ao descriptografar: dados corrompidos ou chave inválida')
  }
}

/**
 * Gera um hash SHA-256 de um texto
 * Usado para armazenar o refresh token do backend de forma segura
 * 
 * @param text - Texto para gerar hash
 * @returns Hash SHA-256 em hex
 */
export function hashSHA256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Gera um token aleatório seguro
 * Usado para criar session IDs e refresh tokens
 * 
 * @param bytes - Número de bytes (padrão: 32 = 64 caracteres hex)
 * @returns Token em formato hex
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Verifica se a ENCRYPTION_KEY está configurada corretamente
 * Útil para verificação no startup da aplicação
 * 
 * @returns true se a chave estiver válida
 * @throws {Error} Se a chave for inválida
 */
export function validateEncryptionKey(): boolean {
  getEncryptionKey() // Throws se inválida
  return true
}
