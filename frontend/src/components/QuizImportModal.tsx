/**
 * QuizImportModal - Modal para importação em lote de perguntas e respostas
 * 
 * Suporta três métodos de importação:
 * - Arquivo CSV
 * - Arquivo JSON
 * - Entrada direta de JSON
 * 
 * Limites:
 * - Máximo de 100 perguntas por importação
 * - Arquivos até 5MB
 */

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, Code, Download, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import apiClient from '../lib/apiClient';

// Template files
import modeloCSV from '../fs/Modelo Quiz.csv?raw';
import modeloJSON from '../fs/Modelo Quiz.json?raw';

// ============================================================================
// TYPES
// ============================================================================

interface ImportQuestion {
  question: string;
  answerOptions: Array<{
    text: string;
    isCorrect: boolean;
    rationale?: string;
  }>;
  hint?: string;
  explanation?: string;
  points?: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  skippedDuplicates: Array<{ index: number; question: string }>;
  errors: Array<{ index: number; message: string }>;
}

interface QuizImportModalProps {
  quizId: string;
  onClose: () => void;
  onSuccess: () => void;
  onNotification: (type: 'success' | 'error', message: string) => void;
}

type TabType = 'csv' | 'json' | 'text';

// ============================================================================
// COMPONENT
// ============================================================================

const QuizImportModal = ({ quizId, onClose, onSuccess, onNotification }: QuizImportModalProps) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('csv');
  
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // JSON text state
  const [jsonText, setJsonText] = useState('');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // ============================================================================
  // FILE HANDLING
  // ============================================================================
  
  const validateFile = (file: File): boolean => {
    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setParseError('Arquivo muito grande. Tamanho máximo: 5MB');
      return false;
    }
    
    // Check file type based on active tab
    if (activeTab === 'csv') {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setParseError('Selecione um arquivo CSV (.csv)');
        return false;
      }
    } else if (activeTab === 'json') {
      if (!file.name.toLowerCase().endsWith('.json')) {
        setParseError('Selecione um arquivo JSON (.json)');
        return false;
      }
    }
    
    return true;
  };
  
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setParseError(null);
    setImportResult(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  }, [activeTab]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setImportResult(null);
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };
  
  const clearFile = () => {
    setSelectedFile(null);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // ============================================================================
  // CSV PARSING
  // ============================================================================
  
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (semicolonCount >= commaCount && semicolonCount >= tabCount) return ';';
    if (tabCount >= commaCount) return '\t';
    return ',';
  };
  
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };
  
  const parseCSV = (text: string): ImportQuestion[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV deve ter pelo menos o cabeçalho e uma linha de dados');
    }
    
    const delimiter = detectDelimiter(text);
    const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().replace(/[áàâã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íìî]/g, 'i').replace(/[óòôõ]/g, 'o').replace(/[úùû]/g, 'u').replace(/ç/g, 'c'));
    
    // Find column indices
    // Note: 'Tipo' column is in the template but not used - question_type is auto-detected from isCorrect count
    const perguntaIdx = headers.findIndex(h => h.includes('pergunta'));
    const dicaIdx = headers.findIndex(h => h.includes('dica'));
    const explicacaoIdx = headers.findIndex(h => h.includes('explicacao'));
    const pontosIdx = headers.findIndex(h => h.includes('ponto'));
    const opcaoIdx = headers.findIndex(h => h.includes('opcao'));
    const corretaIdx = headers.findIndex(h => h.includes('correta'));
    const justificativaIdx = headers.findIndex(h => h.includes('justificativa') || h.includes('rationale'));
    
    if (perguntaIdx === -1) throw new Error('Coluna "Pergunta" não encontrada no CSV');
    if (opcaoIdx === -1) throw new Error('Coluna "Opção" não encontrada no CSV');
    if (corretaIdx === -1) throw new Error('Coluna "Correta" não encontrada no CSV');
    
    // Group rows by question text
    const questionsMap = new Map<string, ImportQuestion>();
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const questionText = values[perguntaIdx]?.replace(/^"|"$/g, '').trim();
      const optionText = values[opcaoIdx]?.replace(/^"|"$/g, '').trim();
      const isCorrectRaw = values[corretaIdx]?.replace(/^"|"$/g, '').trim().toLowerCase();
      
      if (!questionText || !optionText) continue;
      
      const isCorrect = isCorrectRaw === 'true' || isCorrectRaw === '1' || isCorrectRaw === 'sim' || isCorrectRaw === 'yes';
      const rationale = justificativaIdx !== -1 ? values[justificativaIdx]?.replace(/^"|"$/g, '').trim() : undefined;
      
      if (!questionsMap.has(questionText)) {
        questionsMap.set(questionText, {
          question: questionText,
          answerOptions: [],
          hint: dicaIdx !== -1 ? values[dicaIdx]?.replace(/^"|"$/g, '').trim() : undefined,
          explanation: explicacaoIdx !== -1 ? values[explicacaoIdx]?.replace(/^"|"$/g, '').trim() : undefined,
          points: pontosIdx !== -1 ? parseInt(values[pontosIdx]?.replace(/^"|"$/g, '').trim()) || 1 : 1
        });
      }
      
      const question = questionsMap.get(questionText)!;
      question.answerOptions.push({
        text: optionText,
        isCorrect,
        rationale
      });
    }
    
    return Array.from(questionsMap.values());
  };
  
  // ============================================================================
  // JSON PARSING
  // ============================================================================
  
  const parseJSON = (text: string): ImportQuestion[] => {
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      throw new Error('JSON deve ser um array de perguntas');
    }
    
    return data.map((item: any, index: number) => {
      if (!item.question || typeof item.question !== 'string') {
        throw new Error(`Pergunta ${index + 1}: campo "question" é obrigatório`);
      }
      if (!item.answerOptions || !Array.isArray(item.answerOptions)) {
        throw new Error(`Pergunta ${index + 1}: campo "answerOptions" deve ser um array`);
      }
      
      return {
        question: item.question,
        answerOptions: item.answerOptions.map((opt: any, optIdx: number) => {
          if (!opt.text || typeof opt.text !== 'string') {
            throw new Error(`Pergunta ${index + 1}, Opção ${optIdx + 1}: campo "text" é obrigatório`);
          }
          if (typeof opt.isCorrect !== 'boolean') {
            throw new Error(`Pergunta ${index + 1}, Opção ${optIdx + 1}: campo "isCorrect" deve ser true ou false`);
          }
          return {
            text: opt.text,
            isCorrect: opt.isCorrect,
            rationale: opt.rationale
          };
        }),
        hint: item.hint,
        explanation: item.explanation,
        points: item.points
      };
    });
  };
  
  // ============================================================================
  // IMPORT HANDLER
  // ============================================================================
  
  const handleImport = async () => {
    setIsUploading(true);
    setParseError(null);
    setImportResult(null);
    
    try {
      let questions: ImportQuestion[] = [];
      
      if (activeTab === 'text') {
        // Parse JSON text
        if (!jsonText.trim()) {
          throw new Error('Digite ou cole o JSON das perguntas');
        }
        questions = parseJSON(jsonText);
      } else if (selectedFile) {
        // Read file content
        const text = await selectedFile.text();
        
        if (activeTab === 'csv') {
          questions = parseCSV(text);
        } else {
          questions = parseJSON(text);
        }
      } else {
        throw new Error('Selecione um arquivo para importar');
      }
      
      // Validate question count
      if (questions.length === 0) {
        throw new Error('Nenhuma pergunta encontrada para importar');
      }
      
      if (questions.length > 100) {
        throw new Error(`Limite máximo de 100 perguntas por importação. Encontradas: ${questions.length}`);
      }
      
      // Call API
      const response = await apiClient.post<ImportResult>(`/api/quiz/${quizId}/questions/bulk-import`, {
        questions
      });
      
      if (response.success && response.data) {
        setImportResult(response.data);
        
        if (response.data.imported > 0) {
          onSuccess();
          onNotification('success', `${response.data.imported} pergunta(s) importada(s) com sucesso!`);
        }
      } else {
        throw new Error(response.error?.message || 'Erro ao importar perguntas');
      }
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      setParseError(error.message || 'Erro ao processar arquivo');
    } finally {
      setIsUploading(false);
    }
  };
  
  // ============================================================================
  // DOWNLOAD TEMPLATES
  // ============================================================================
  
  const downloadTemplate = (type: 'csv' | 'json') => {
    const content = type === 'csv' ? modeloCSV : modeloJSON;
    const mimeType = type === 'csv' ? 'text/csv' : 'application/json';
    const filename = type === 'csv' ? 'Modelo Quiz.csv' : 'Modelo Quiz.json';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const getAcceptedExtension = () => {
    return activeTab === 'csv' ? '.csv' : '.json';
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Perguntas
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setActiveTab('csv'); clearFile(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'csv'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Arquivo CSV
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('json'); clearFile(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'json'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Arquivo JSON
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('text'); clearFile(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Escrever JSON
              </div>
            </button>
          </div>
          
          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Informações da Importação:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Máximo de <strong>100 perguntas</strong> por importação</li>
                  <li>Perguntas duplicadas serão <strong>ignoradas</strong> automaticamente</li>
                  <li>O tipo da pergunta é <strong>detectado automaticamente</strong> (single/multiple choice)</li>
                  <li>Cada pergunta deve ter pelo menos <strong>2 opções</strong> e <strong>1 resposta correta</strong></li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Download templates */}
          {(activeTab === 'csv' || activeTab === 'json') && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Baixar modelo:</span>
              <button
                onClick={() => downloadTemplate(activeTab === 'csv' ? 'csv' : 'json')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <Download className="w-4 h-4" />
                Modelo {activeTab === 'csv' ? 'CSV' : 'JSON'}
              </button>
            </div>
          )}
          
          {/* File upload area */}
          {(activeTab === 'csv' || activeTab === 'json') && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : selectedFile
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">Arquivo selecionado</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedFile.name}</p>
                  <button
                    onClick={clearFile}
                    className="text-sm text-red-500 hover:text-red-700 underline"
                  >
                    Remover arquivo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Arraste e solte o arquivo {activeTab.toUpperCase()} aqui
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">ou</p>
                  </div>
                  <label className="inline-block">
                    <span className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 cursor-pointer transition-colors">
                      Selecionar arquivo
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAcceptedExtension()}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* JSON text input */}
          {activeTab === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cole o JSON das perguntas:
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setParseError(null); setImportResult(null); }}
                className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                placeholder={`[\n  {\n    "question": "Sua pergunta aqui?",\n    "answerOptions": [\n      { "text": "Opção A", "isCorrect": false },\n      { "text": "Opção B", "isCorrect": true }\n    ],\n    "hint": "Dica opcional"\n  }\n]`}
              />
            </div>
          )}
          
          {/* Error display */}
          {parseError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700 dark:text-red-400">
                  <p className="font-medium">Erro:</p>
                  <p>{parseError}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Import result */}
          {importResult && (
            <div className="space-y-3">
              {/* Summary */}
              <div className={`rounded-lg p-4 ${
                importResult.imported > 0
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  {importResult.imported > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-gray-100">Resultado da Importação</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.imported}</p>
                    <p className="text-gray-500 dark:text-gray-400">Importadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{importResult.skipped}</p>
                    <p className="text-gray-500 dark:text-gray-400">Duplicadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult.errors.length}</p>
                    <p className="text-gray-500 dark:text-gray-400">Erros</p>
                  </div>
                </div>
              </div>
              
              {/* Skipped duplicates */}
              {importResult.skippedDuplicates.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                    Perguntas duplicadas ignoradas:
                  </p>
                  <ul className="text-xs text-yellow-600 dark:text-yellow-500 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.skippedDuplicates.map((dup, idx) => (
                      <li key={idx}>Linha {dup.index}: {dup.question}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                    Erros encontrados:
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-500 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>Linha {err.index}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleImport}
              disabled={isUploading || (activeTab !== 'text' && !selectedFile) || (activeTab === 'text' && !jsonText.trim())}
              className="px-6 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizImportModal;
