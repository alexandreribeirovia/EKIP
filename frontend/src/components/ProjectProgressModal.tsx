// src/components/ProjectProgressModal.tsx

import { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Edit, X, Plus, GripVertical, Trash2, Upload, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DbProject, DbProjectPhase, DbDomain } from '../types';

interface ProjectProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DbProject;
  projectWeeks: { value: number; label: string }[];
  selectedWeek: number;
  onWeekChange: (week: number) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onProjectPhasesUpdate: (phases: DbProjectPhase[]) => void;
}

const ProjectProgressModal = ({ 
  isOpen, 
  onClose, 
  project, 
  projectWeeks, 
  selectedWeek, 
  onWeekChange,
  onSuccess,
  onError,
  onProjectPhasesUpdate
}: ProjectProgressModalProps) => {
  // Estados do modal
  const [editingPhases, setEditingPhases] = useState<DbProjectPhase[]>([]);
  const [availablePhases, setAvailablePhases] = useState<DbDomain[]>([]);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [phaseToDelete, setPhaseToDelete] = useState<DbProjectPhase | null>(null);
  
  // Estados para upload de CSV
  const [showUploadInterface, setShowUploadInterface] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  // Função para carregar fases da semana selecionada
  const loadPhasesForWeek = useCallback(async (week: number) => {
    if (!project.project_id) return;

    try {
      // Buscar fases específicas da semana
      const { data: phasesData, error: phasesError } = await supabase
        .from('projects_phase')
        .select('*')
        .eq('project_id', project.project_id)
        .eq('period', week)
        .order('order', { ascending: true });

      if (phasesError) {
        console.error('Erro ao buscar fases da semana:', phasesError);
        setEditingPhases([]);
        return;
      }

      // Buscar domínios das fases
      const { data: domainsData, error: domainsError } = await supabase
        .from('domains')
        .select('id, value')
        .eq('type', 'project_phase')
        .eq('is_active', true);

      if (domainsError) {
        console.error('Erro ao buscar domínios das fases:', domainsError);
        setEditingPhases([]);
        return;
      }

      setAvailablePhases((domainsData || []) as DbDomain[]);

      // Se não há fases para esta semana, copiar as fases da semana 1 (ou criar fases padrão)
      if (!phasesData || phasesData.length === 0) {
        // Buscar fases da semana 1 como template
        const { data: week1Phases } = await supabase
          .from('projects_phase')
          .select('*')
          .eq('project_id', project.project_id)
          .eq('period', 1)
          .order('order', { ascending: true });

        if (week1Phases && week1Phases.length > 0) {
          // Criar novas fases baseadas na semana 1, mas sem dados de progresso
          const templatePhases = week1Phases.map((phase: any, index: number) => ({
            id: Date.now() + index, // ID temporário
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            project_id: project.project_id,
            domains_id: phase.domains_id,
            progress: 0,
            expected_progress: 0,
            order: phase.order,
            period: week,
            phase_name: phase.phase_name,
            isNew: true // Flag para indicar que é uma nova fase
          }));
          setEditingPhases(templatePhases as DbProjectPhase[]);
        } else {
          setEditingPhases([]);
        }
      } else {
        // Enriquecer com nomes das fases dos domínios
        const phasesWithNames = phasesData.map((phase: any) => {
          const domain = domainsData?.find(d => d.id === phase.domains_id);
          return {
            ...phase,
            phase_name: domain?.value || 'Fase desconhecida'
          };
        });
        setEditingPhases(phasesWithNames as DbProjectPhase[]);
      }
    } catch (error) {
      console.error('Erro ao carregar fases da semana:', error);
      setEditingPhases([]);
    }
  }, [project.project_id]);

  // Função para salvar fases da semana atual (auto-save)
  const saveCurrentWeekPhases = useCallback(async (weekNumber: number) => {
    try {
      // Filtrar apenas fases da semana atual
      const currentWeekPhases = editingPhases.filter(phase => 
        (phase.period === weekNumber) || 
        ((phase as any).isNew && (!phase.period || phase.period === weekNumber))
      );

      if (currentWeekPhases.length === 0) {
        return; // Nada para salvar
      }

      // Separar fases novas das existentes
      const newPhases = currentWeekPhases.filter((phase: any) => phase.isNew);
      const existingPhases = currentWeekPhases.filter((phase: any) => !phase.isNew);

      // Inserir novas fases
      if (newPhases.length > 0) {
        const insertPromises = newPhases.map((phase: any) => 
          supabase
            .from('projects_phase')
            .insert({
              project_id: phase.project_id,
              domains_id: phase.domains_id,
              progress: phase.progress,
              expected_progress: phase.expected_progress,
              order: phase.order,
              period: weekNumber
            })
            .select()
        );

        const insertResults = await Promise.all(insertPromises);
        const hasInsertError = insertResults.some(result => result.error);
        
        if (hasInsertError) {
          const errorResult = insertResults.find(result => result.error);
          console.error('Erro ao inserir novas fases:', errorResult?.error);
          return; // Retorna sem lançar exceção
        }
      }

      // Atualizar fases existentes
      if (existingPhases.length > 0) {
        const updatePromises = existingPhases.map((phase: any) => 
          supabase
            .from('projects_phase')
            .update({
              progress: phase.progress,
              expected_progress: phase.expected_progress,
              order: phase.order
            })
            .eq('id', phase.id)
        );

        const updateResults = await Promise.all(updatePromises);
        const hasUpdateError = updateResults.some(result => result.error);
        
        if (hasUpdateError) {
          const errorResult = updateResults.find(result => result.error);
          console.error('Erro ao atualizar fases:', errorResult?.error);
          return; // Retorna sem lançar exceção
        }
      }

      // Buscar todas as fases do projeto para atualizar o componente pai
      const { data: allProjectPhases } = await supabase
        .from('projects_phase')
        .select('*')
        .eq('project_id', project.project_id);

      if (allProjectPhases) {
        // Enriquecer com nomes das fases
        const { data: domainsData } = await supabase
          .from('domains')
          .select('id, value')
          .eq('type', 'project_phase')
          .eq('is_active', true);

        const phasesWithNames = allProjectPhases.map((phase: any) => {
          const domain = domainsData?.find(d => d.id === phase.domains_id);
          return {
            ...phase,
            phase_name: domain?.value || 'Fase desconhecida'
          };
        });
        
        onProjectPhasesUpdate(phasesWithNames as DbProjectPhase[]);
      }

    } catch (error) {
      console.error('Erro ao salvar fases da semana:', error);
      throw error; // Re-throw para o calling code tratar
    }
  }, [editingPhases, project.project_id, onProjectPhasesUpdate]);

  // Função para adicionar nova fase
  const handleAddNewPhase = useCallback(() => {
    // Verificar se ainda há fases disponíveis para adicionar
    const existingPhaseIds = editingPhases
      .filter(phase => !(phase as any).isNew)
      .map(phase => phase.domains_id);
    
    const availablePhasesCount = availablePhases.filter(phase => 
      !existingPhaseIds.includes(phase.id)
    ).length;

    if (availablePhasesCount === 0) {
      onError('Todas as fases disponíveis já estão cadastradas nesta semana.');
      return;
    }

    const newPhase = {
      id: Date.now(), // ID temporário
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: project.project_id,
      domains_id: 0, // Será definido quando o usuário selecionar
      progress: 0,
      expected_progress: 0,
      order: editingPhases.length + 1,
      period: selectedWeek, // Incluir a semana selecionada
      phase_name: '', // Será definido quando o usuário selecionar
      isNew: true // Flag para identificar novas fases
    } as DbProjectPhase & { isNew: boolean };

    setEditingPhases(prev => [...prev, newPhase]);
  }, [editingPhases, project.project_id, availablePhases, selectedWeek, onError]);

  // Função para adicionar todas as fases restantes
  const handleAddAllPhases = useCallback(() => {
    // Verificar quais fases ainda não estão cadastradas
    const existingPhaseIds = editingPhases
      .filter(phase => !(phase as any).isNew)
      .map(phase => phase.domains_id);
    
    const remainingPhases = availablePhases.filter(phase => 
      !existingPhaseIds.includes(phase.id)
    );

    if (remainingPhases.length === 0) {
      onError('Todas as fases disponíveis já estão cadastradas nesta semana.');
      return;
    }

    const newPhases = remainingPhases.map((phase, index) => ({
      id: Date.now() + index, // ID temporário
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: project.project_id,
      domains_id: phase.id,
      progress: 0,
      expected_progress: 0,
      order: editingPhases.length + index + 1,
      period: selectedWeek,
      phase_name: phase.value,
      isNew: true // Flag para identificar novas fases
    })) as (DbProjectPhase & { isNew: boolean })[];

    setEditingPhases(prev => [...prev, ...newPhases]);
  }, [editingPhases, availablePhases, project.project_id, selectedWeek, onError]);

  // Função para salvar as alterações das fases
  const handleSavePhases = useCallback(async () => {
    try {
      // Validar novas fases
      const newPhases = editingPhases.filter((phase: any) => phase.isNew);
      
      // Verificar se novas fases têm fase selecionada
      const invalidNewPhases = newPhases.filter((phase: any) => !phase.phase_name || phase.domains_id === 0);
      if (invalidNewPhases.length > 0) {
        onError('Por favor, selecione a fase para todas as novas linhas adicionadas.');
        return;
      }

      // Salvar as fases
      await saveCurrentWeekPhases(selectedWeek);
      onSuccess(`Progresso da Semana ${selectedWeek} salvo com sucesso!`);
      
      // Recarregar fases da semana atual para refletir mudanças
      await loadPhasesForWeek(selectedWeek);
      
      // Fechar o modal após salvar com sucesso
      onClose();
    } catch (error) {
      console.error('Erro ao salvar fases:', error);
      onError('Erro ao salvar alterações. Tente novamente.');
    }
  }, [editingPhases, selectedWeek, saveCurrentWeekPhases, loadPhasesForWeek, onSuccess, onError, onClose]);

  // Função para reordenar as fases quando uma linha é movida
  const handleRowDragEnd = useCallback((event: any) => {
    const { overIndex, node } = event;
    if (overIndex === undefined || !node) return;

    const fromIndex = editingPhases.findIndex(phase => phase.id === node.data.id);
    const toIndex = overIndex;

    if (fromIndex === toIndex) return;

    // Reordenar o array
    const newPhases = [...editingPhases];
    const [movedPhase] = newPhases.splice(fromIndex, 1);
    newPhases.splice(toIndex, 0, movedPhase);

    // Atualizar os números de ordem
    const reorderedPhases = newPhases.map((phase, index) => ({
      ...phase,
      order: index + 1
    }));

    setEditingPhases(reorderedPhases);
  }, [editingPhases]);

  // Função para abrir modal de confirmação de exclusão
  const handleDeletePhase = useCallback((phase: DbProjectPhase) => {
    setPhaseToDelete(phase);
    setIsDeleteConfirmModalOpen(true);
  }, []);

  // Função para confirmar a exclusão da fase
  const handleConfirmDeletePhase = useCallback(async () => {
    if (!phaseToDelete) return;

    try {
      // Deletar do banco de dados
      const { error } = await supabase
        .from('projects_phase')
        .delete()
        .eq('id', phaseToDelete.id);

      if (error) {
        console.error('Erro ao deletar fase:', error);
        onError('Erro ao deletar fase. Tente novamente.');
        setIsDeleteConfirmModalOpen(false);
        setPhaseToDelete(null);
        return;
      }

      // Remover da lista local
      const updatedPhases = editingPhases.filter(phase => phase.id !== phaseToDelete.id);
      setEditingPhases(updatedPhases);

      // Buscar todas as fases do projeto para atualizar o componente pai
      const { data: allProjectPhases } = await supabase
        .from('projects_phase')
        .select('*')
        .eq('project_id', project.project_id);

      if (allProjectPhases) {
        // Enriquecer com nomes das fases
        const { data: domainsData } = await supabase
          .from('domains')
          .select('id, value')
          .eq('type', 'project_phase')
          .eq('is_active', true);

        const phasesWithNames = allProjectPhases.map((phase: any) => {
          const domain = domainsData?.find(d => d.id === phase.domains_id);
          return {
            ...phase,
            phase_name: domain?.value || 'Fase desconhecida'
          };
        });
        
        onProjectPhasesUpdate(phasesWithNames as DbProjectPhase[]);
      }

      onSuccess('Fase deletada com sucesso!');
      setIsDeleteConfirmModalOpen(false);
      setPhaseToDelete(null);
    } catch (error) {
      console.error('Erro ao deletar fase:', error);
      onError('Erro ao deletar fase. Tente novamente.');
      setIsDeleteConfirmModalOpen(false);
      setPhaseToDelete(null);
    }
  }, [editingPhases, phaseToDelete, project.project_id, onProjectPhasesUpdate, onSuccess, onError]);

  // Funções para upload de CSV
  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      onError('Por favor, selecione um arquivo CSV válido.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      onError('O arquivo deve ter no máximo 5MB.');
      return;
    }
    
    setSelectedFile(file);
  }, [onError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Função para detectar delimitador do CSV
  const detectDelimiter = (line: string): string => {
    const delimiters = [',', ';', '\t'];
    let maxCount = 0;
    let detectedDelimiter = ',';

    for (const delimiter of delimiters) {
      const count = line.split(delimiter).length - 1;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }

    return detectedDelimiter;
  };

  // Função para parsear linha CSV respeitando aspas
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
          i++; // Skip next quote 
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

  const handleUploadCSV = useCallback(async () => {
    if (!selectedFile) {
      onError('Por favor, selecione um arquivo CSV.');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0, message: 'Lendo arquivo...' });

    try {
      // Função para ler arquivo como ArrayBuffer e decodificar com TextDecoder
      const readFileAsArrayBuffer = async (): Promise<ArrayBuffer> => {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(selectedFile);
        });
      };

      // Detectar caracteres corrompidos comuns
      const hasCorruptedChars = (text: string): boolean => {
        // � = caractere de substituição Unicode (U+FFFD)
        // Sequências comuns de UTF-8 mal interpretado
        return /[\uFFFDÂ]|â€/.test(text) || /Ã[§£¡©­³º\sA-Za-z]/.test(text);
      };

      // Ler arquivo como ArrayBuffer
      setUploadProgress({ current: 0, total: 0, message: 'Lendo arquivo...' });
      const arrayBuffer = await readFileAsArrayBuffer();
      
      // Lista de codificações para tentar
      const encodings = ['utf-8', 'windows-1252', 'iso-8859-1', 'windows-1250'];
      let fileContent = '';
      let encodingUsed = '';
      
      // Tentar cada codificação
      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: false });
          const decoded = decoder.decode(arrayBuffer);
          
          console.log(`Tentando ${encoding}:`, decoded.substring(0, 200));
          
          if (!hasCorruptedChars(decoded)) {
            fileContent = decoded;
            encodingUsed = encoding;
            console.log(`✓ ${encoding} funcionou!`);
            break;
          } else {
            console.log(`✗ ${encoding} resultou em caracteres corrompidos`);
          }
        } catch (err) {
          console.warn(`Erro ao tentar ${encoding}:`, err);
        }
      }
      
      // Se nenhuma codificação funcionou, usar a primeira (UTF-8) mesmo assim
      if (!fileContent) {
        console.warn('⚠️ Nenhuma codificação resultou em texto limpo. Usando UTF-8 por padrão.');
        const decoder = new TextDecoder('utf-8', { fatal: false });
        fileContent = decoder.decode(arrayBuffer);
        encodingUsed = 'utf-8 (fallback)';
      }
      
      if (encodingUsed && encodingUsed !== 'utf-8') {
        setUploadProgress({ 
          current: 0, 
          total: 0, 
          message: `Codificação ${encodingUsed} detectada e corrigida` 
        });
        // Pequeno delay para mostrar a mensagem
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('Codificação final usada:', encodingUsed);
      console.log('Primeiras 200 caracteres do conteúdo final:', fileContent.substring(0, 200));

      // Dividir em linhas e remover linhas vazias
      const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        onError('Arquivo CSV vazio ou sem dados.');
        return;
      }

      // Detectar delimitador
      const delimiter = detectDelimiter(lines[0]);
      
      // Parsear cabeçalho
      const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
      
      // Validar colunas obrigatórias
      const requiredColumns = ['Projeto', 'Fase', 'Progresso', 'Progresso esperado', 'Ordem', 'Semana'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        onError(`Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`);
        return;
      }

      // Mapear índices das colunas
      const colIndexes = {
        projeto: headers.indexOf('Projeto'),
        fase: headers.indexOf('Fase'),
        progresso: headers.indexOf('Progresso'),
        progressoEsperado: headers.indexOf('Progresso esperado'),
        ordem: headers.indexOf('Ordem'),
        semana: headers.indexOf('Semana')
      };

      // Buscar todos os projetos uma vez
      setUploadProgress({ current: 0, total: lines.length - 1, message: 'Carregando projetos...' });
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('project_id, name');

      if (projectsError) {
        onError(`Erro ao buscar projetos: ${projectsError.message}`);
        return;
      }

      // Buscar todos os domínios de fases uma vez
      setUploadProgress({ current: 0, total: lines.length - 1, message: 'Carregando fases...' });
      const { data: allPhases, error: phasesError } = await supabase
        .from('domains')
        .select('id, value')
        .eq('type', 'project_phase')
        .eq('is_active', true);

      if (phasesError) {
        onError(`Erro ao buscar fases: ${phasesError.message}`);
        return;
      }

      // Criar mapas para busca rápida
      const projectMap = new Map(allProjects?.map(p => [p.name.toLowerCase().trim(), p.project_id]) || []);
      const phaseMap = new Map(allPhases?.map(p => [p.value.toLowerCase().trim(), p.id]) || []);
      
      console.log('Fases carregadas do banco de dados:', Array.from(phaseMap.keys()));
      console.log('Projetos carregados:', Array.from(projectMap.keys()));

      // Processar linhas de dados
      const dataRows = lines.slice(1);
      const recordsToInsert: any[] = [];
      const errors: string[] = [];
      
      // Validação de duplicatas por período
      const periodValidation = new Map<string, Set<number>>(); // Map<period_projectId, Set<domains_id>>
      const orderValidation = new Map<string, Set<number>>(); // Map<period_projectId, Set<order>>

      for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = i + 2; // +2 porque linha 1 é header e arrays começam em 0
        setUploadProgress({ 
          current: i + 1, 
          total: dataRows.length, 
          message: `Processando linha ${rowIndex}...` 
        });

        try {
          const values = parseCSVLine(dataRows[i], delimiter);
          
          // Extrair valores
          const projectName = values[colIndexes.projeto]?.trim();
          const faseName = values[colIndexes.fase]?.trim();
          const progresso = parseFloat(values[colIndexes.progresso] || '0');
          const progressoEsperado = parseFloat(values[colIndexes.progressoEsperado] || '0');
          const ordem = parseInt(values[colIndexes.ordem] || '0');
          const semana = parseInt(values[colIndexes.semana] || '0');

          // Validar valores obrigatórios
          if (!projectName) {
            errors.push(`Linha ${rowIndex}: Nome do projeto não informado`);
            continue;
          }

          if (!faseName) {
            errors.push(`Linha ${rowIndex}: Fase não informada`);
            continue;
          }

          if (isNaN(ordem) || ordem <= 0) {
            errors.push(`Linha ${rowIndex}: Ordem inválida`);
            continue;
          }

          if (isNaN(semana) || semana <= 0) {
            errors.push(`Linha ${rowIndex}: Semana inválida`);
            continue;
          }

          // Buscar project_id
          const projectId = projectMap.get(projectName.toLowerCase());
          if (!projectId) {
            errors.push(`Linha ${rowIndex}: Projeto "${projectName}" não encontrado`);
            continue;
          }

          // Buscar domains_id
          const faseNameNormalized = faseName.toLowerCase().trim();
          const domainId = phaseMap.get(faseNameNormalized);
          
          console.log(`Linha ${rowIndex}: Procurando fase "${faseName}" (normalizado: "${faseNameNormalized}")`);
          
          if (!domainId) {
            // Listar fases disponíveis para ajudar no debug
            const availablePhases = Array.from(phaseMap.keys()).join(', ');
            console.error(`Fase "${faseName}" não encontrada. Fases disponíveis: ${availablePhases}`);
            
            // Tentar encontrar fase similar (pode ser problema de codificação)
            const similarPhase = Array.from(phaseMap.keys()).find(phase => 
              phase.replace(/[àáâãäå]/gi, 'a')
                   .replace(/[èéêë]/gi, 'e')
                   .replace(/[ìíîï]/gi, 'i')
                   .replace(/[òóôõö]/gi, 'o')
                   .replace(/[ùúûü]/gi, 'u')
                   .replace(/ç/gi, 'c') === 
              faseNameNormalized.replace(/[àáâãäå]/gi, 'a')
                                .replace(/[èéêë]/gi, 'e')
                                .replace(/[ìíîï]/gi, 'i')
                                .replace(/[òóôõö]/gi, 'o')
                                .replace(/[ùúûü]/gi, 'u')
                                .replace(/ç/gi, 'c')
            );
            
            if (similarPhase) {
              errors.push(`Linha ${rowIndex}: Fase "${faseName}" não encontrada. Você quis dizer "${similarPhase}"? (Problema de acentuação)`);
            } else {
              errors.push(`Linha ${rowIndex}: Fase "${faseName}" não encontrada. Fases válidas: ${availablePhases}`);
            }
            continue;
          }

          // Validar regras de duplicidade
          const periodKey = `${semana}_${projectId}`;
          
          // Validar domínio duplicado no mesmo período
          if (!periodValidation.has(periodKey)) {
            periodValidation.set(periodKey, new Set());
          }
          if (periodValidation.get(periodKey)!.has(domainId)) {
            errors.push(`Linha ${rowIndex}: Fase "${faseName}" duplicada na semana ${semana} para o projeto "${projectName}"`);
            continue;
          }
          periodValidation.get(periodKey)!.add(domainId);

          // Validar ordem duplicada no mesmo período
          if (!orderValidation.has(periodKey)) {
            orderValidation.set(periodKey, new Set());
          }
          if (orderValidation.get(periodKey)!.has(ordem)) {
            errors.push(`Linha ${rowIndex}: Ordem ${ordem} duplicada na semana ${semana} para o projeto "${projectName}"`);
            continue;
          }
          orderValidation.get(periodKey)!.add(ordem);

          // Adicionar registro para inserção
          recordsToInsert.push({
            project_id: projectId,
            domains_id: domainId,
            progress: Math.min(100, Math.max(0, progresso)),
            expected_progress: Math.min(100, Math.max(0, progressoEsperado)),
            order: ordem,
            period: semana
          });

        } catch (error) {
          errors.push(`Linha ${rowIndex}: ${error instanceof Error ? error.message : 'Erro ao processar'}`);
        }
      }

      // Se houver erros, mostrar e perguntar se quer continuar
      if (errors.length > 0) {
        const errorMessage = `Encontrados ${errors.length} erro(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... e mais ${errors.length - 10} erro(s)` : ''}`;
        
        if (!confirm(`${errorMessage}\n\nDeseja continuar com os ${recordsToInsert.length} registro(s) válido(s)?`)) {
          onError('Importação cancelada pelo usuário.');
          return;
        }
      }

      if (recordsToInsert.length === 0) {
        onError('Nenhum registro válido para importar.');
        return;
      }

      // Inserir/atualizar registros no Supabase
      setUploadProgress({ 
        current: 0, 
        total: recordsToInsert.length, 
        message: 'Salvando dados no banco...' 
      });

      let insertedCount = 0;
      let updatedCount = 0;

      // Processar em lotes para melhor performance
      const batchSize = 50;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        
        for (const record of batch) {
          // Verificar se já existe registro para este projeto/fase/período
          const { data: existing, error: existingError } = await supabase
            .from('projects_phase')
            .select('id')
            .eq('project_id', record.project_id)
            .eq('domains_id', record.domains_id)
            .eq('period', record.period)
            .maybeSingle();

          if (existingError) {
            errors.push(`Erro ao verificar registro existente: ${existingError.message}`);
            continue;
          }

          if (existing) {
            // Atualizar registro existente
            const { error: updateError } = await supabase
              .from('projects_phase')
              .update({
                progress: record.progress,
                expected_progress: record.expected_progress,
                order: record.order
              })
              .eq('id', existing.id);

            if (updateError) {
              errors.push(`Erro ao atualizar registro: ${updateError.message}`);
            } else {
              updatedCount++;
            }
          } else {
            // Inserir novo registro
            const { error: insertError } = await supabase
              .from('projects_phase')
              .insert(record);

            if (insertError) {
              errors.push(`Erro ao inserir registro: ${insertError.message}`);
            } else {
              insertedCount++;
            }
          }
        }

        setUploadProgress({ 
          current: Math.min(i + batchSize, recordsToInsert.length), 
          total: recordsToInsert.length, 
          message: `Salvando... ${Math.min(i + batchSize, recordsToInsert.length)}/${recordsToInsert.length}` 
        });
      }

      // Recarregar fases da semana atual
      await loadPhasesForWeek(selectedWeek);

      // Mensagem de sucesso
      const successMessage = [
        '✅ Arquivo processado com sucesso!',
        '',
        `📄 Arquivo: ${selectedFile.name}`,
        `📊 Linhas processadas: ${dataRows.length}`,
        `✅ Linhas válidas: ${recordsToInsert.length}`,
        `➕ Registros inseridos: ${insertedCount}`,
        `🔄 Registros atualizados: ${updatedCount}`,
        `❌ Erros: ${errors.length}`,
        `🔍 Separador detectado: "${delimiter}"`
      ].join('\n');

      onSuccess(successMessage);
      setShowUploadInterface(false);
      setSelectedFile(null);
      setUploadProgress(null);
      
      // Fechar o modal após upload bem-sucedido
      onClose();
           
    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      onError(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, selectedWeek, loadPhasesForWeek, onSuccess, onError, onClose]);

  const handleShowUploadInterface = useCallback(() => {
    setShowUploadInterface(true);
    setSelectedFile(null);
  }, []);

  const handleCloseUploadInterface = useCallback(() => {
    setShowUploadInterface(false);
    setSelectedFile(null);
  }, []);

  // Definições das colunas para o grid de edição de fases
  const phaseColumnDefs: ColDef[] = [
    {
      headerName: '',
      width: 40,
      cellRenderer: () => <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />,
      rowDrag: true,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
    },
    { 
      headerName: 'Ordem', 
      field: 'order', 
      width: 80,
      editable: false,
      cellStyle: { textAlign: 'center' },
    },
    { 
      headerName: 'Fase', 
      field: 'phase_name', 
      flex: 2, 
      minWidth: 200,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: availablePhases
          .filter(phase => {
            // Filtrar fases que já estão cadastradas no projeto
            const existingPhaseIds = editingPhases
              .filter(p => !(p as any).isNew)
              .map(p => p.domains_id);
            return !existingPhaseIds.includes(phase.id);
          })
          .map(phase => phase.value),
      },
      valueGetter: (params) => {
        // Para fases existentes, mostrar o nome atual
        if (params.data.phase_name && !params.data.isNew) {
          return params.data.phase_name;
        }
        // Para novas fases, mostrar valor selecionado
        return params.data.phase_name || '';
      },
      onCellValueChanged: (event) => {
        if (event.data.isNew) {
          // Encontrar o domain_id baseado no valor selecionado
          const selectedPhase = availablePhases.find(phase => phase.value === event.newValue);
          if (selectedPhase) {
            // Verificar se a fase já existe no projeto
            const existingPhase = editingPhases.find(phase => 
              !(phase as any).isNew && phase.domains_id === selectedPhase.id
            );
            
            if (existingPhase) {
              onError(`A fase "${event.newValue}" já está cadastrada no projeto.`);
              return;
            }

            const updatedPhases = editingPhases.map(phase => 
              phase.id === event.data.id 
                ? { 
                    ...phase, 
                    phase_name: event.newValue,
                    domains_id: selectedPhase.id,
                    domains: { id: selectedPhase.id, value: selectedPhase.value }
                  }
                : phase
            );
            setEditingPhases(updatedPhases);
          }
        }
      },
    },
    { 
      headerName: 'Progresso (%)', 
      field: 'progress', 
      flex: 1, 
      minWidth: 150,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        max: 100,
        precision: 1,
      },
      valueFormatter: (params) => `${params.value?.toFixed(1) || 0}%`,
      onCellValueChanged: (event) => {
        const updatedPhases = editingPhases.map(phase => 
          phase.id === event.data.id 
            ? { ...phase, progress: Math.min(100, Math.max(0, event.newValue)) }
            : phase
        );
        setEditingPhases(updatedPhases);
      },
    },
    { 
      headerName: 'Progresso Esperado (%)', 
      field: 'expected_progress', 
      flex: 1, 
      minWidth: 180,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        max: 100,
        precision: 1,
      },
      valueFormatter: (params) => `${params.value?.toFixed(1) || 0}%`,
      onCellValueChanged: (event) => {
        const updatedPhases = editingPhases.map(phase => 
          phase.id === event.data.id 
            ? { ...phase, expected_progress: Math.min(100, Math.max(0, event.newValue)) }
            : phase
        );
        setEditingPhases(updatedPhases);
      },
    },
    {
      headerName: 'Ações',
      width: 80,
      cellRenderer: (params: any) => {
        if (params.data?.isNew) {
          // Botão X para remover novas fases (apenas da lista local)
          return (
            <button
              onClick={() => {
                const updatedPhases = editingPhases.filter(phase => phase.id !== params.data.id);
                setEditingPhases(updatedPhases);
              }}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title="Remover fase"
            >
              <X className="w-4 h-4" />
            </button>
          );
        } else {
          // Ícone de lixeira para deletar fases existentes do banco
          return (
            <button
              onClick={() => handleDeletePhase(params.data)}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title="Deletar fase do projeto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          );
        }
      },
      sortable: false,
      filter: false,
      editable: false,
      resizable: false,
      suppressMovable: true,
    },
  ];

  // Handler para mudança de semana
  const handleWeekChange = async (newWeek: number) => {
    // Auto-salvar alterações da semana atual antes de trocar
    if (editingPhases.length > 0 && selectedWeek !== newWeek) {
      try {
        // Verificar se há alterações para salvar
        const hasChanges = editingPhases.some((phase: any) => {
          if (phase.isNew) return true; // Nova fase sempre precisa ser salva
          
          // Para fases existentes, verificar se houve mudança real
          // (Seria ideal ter um estado inicial para comparar, mas usaremos heurística)
          return phase.progress > 0 || phase.expected_progress > 0;
        });

        if (hasChanges) {
          // Validar novas fases antes de salvar
          const newPhases = editingPhases.filter((phase: any) => phase.isNew);
          const invalidNewPhases = newPhases.filter((phase: any) => !phase.phase_name || phase.domains_id === 0);
          
          if (invalidNewPhases.length > 0) {
            onError('Por favor, selecione a fase para todas as novas linhas antes de trocar de semana.');
            return; // Não trocar de semana se há dados inválidos
          }

          // Salvar automaticamente
          await saveCurrentWeekPhases(selectedWeek);
          onSuccess(`Alterações da Semana ${selectedWeek} salvas automaticamente!`);
        }
      } catch (error) {
        console.error('Erro ao salvar alterações automaticamente:', error);
        onError('Erro ao salvar alterações da semana atual. Tente novamente.');
        return; // Não trocar de semana se falhou ao salvar
      }
    }

    // Trocar para a nova semana
    onWeekChange(newWeek);
    await loadPhasesForWeek(newWeek);
  };

  // Handler para fechar modal
  const handleCloseModal = async () => {
    // Auto-salvar antes de fechar o modal
    if (editingPhases.length > 0) {
      try {
        const hasChanges = editingPhases.some((phase: any) => {
          if (phase.isNew) return true;
          return phase.progress > 0 || phase.expected_progress > 0;
        });

        if (hasChanges) {
          const newPhases = editingPhases.filter((phase: any) => phase.isNew);
          const invalidNewPhases = newPhases.filter((phase: any) => !phase.phase_name || phase.domains_id === 0);
          
          if (invalidNewPhases.length === 0) {
            await saveCurrentWeekPhases(selectedWeek);
            onSuccess(`Alterações da Semana ${selectedWeek} salvas automaticamente!`);
          }
        }
      } catch (error) {
        console.error('Erro ao salvar ao fechar modal:', error);
        // Não impedir o fechamento do modal em caso de erro
      }
    }
    onClose();
  };

  // Carregar fases da semana selecionada quando o modal abrir
  useEffect(() => {
    if (isOpen && selectedWeek) {
      void loadPhasesForWeek(selectedWeek);
    }
  }, [isOpen, selectedWeek, loadPhasesForWeek]);

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Principal de Edição das Fases */}
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Edit className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Editar Progresso das Fases</h2>
                <p className="text-primary-100 text-sm">{project.name}</p>
              </div>
            </div>
            <button
              onClick={handleCloseModal}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {!showUploadInterface ? (
              <>
                {/* Selector de Semana */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Semana do Projeto
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => handleWeekChange(parseInt(e.target.value))}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {projectWeeks.map((week) => (
                      <option key={week.value} value={week.value}>
                        {week.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Selecione a semana para visualizar e editar os progressos das fases. 
                    <span className="font-medium">As alterações são salvas automaticamente ao trocar de semana.</span>
                  </p>
                </div>

                <div className="ag-theme-alpine w-full h-96">
                  <AgGridReact
                    columnDefs={phaseColumnDefs}
                    rowData={editingPhases}
                    defaultColDef={{ 
                      sortable: false, 
                      filter: false, 
                      resizable: true,
                      suppressMovable: true
                    }}
                    animateRows={true}
                    rowHeight={48}
                    headerHeight={48}
                    stopEditingWhenCellsLoseFocus={true}
                    singleClickEdit={true}
                    rowDragManaged={true}
                    onRowDragEnd={handleRowDragEnd}
                    suppressRowClickSelection={true}
                    overlayNoRowsTemplate="<span class='text-gray-500 text-sm'>Não há fases cadastradas</span>"
                  />
                </div>
              </>
            ) : (
              /* Interface de Upload de CSV */
              <div className="space-y-6">
                <div className="text-center">
                  <Upload className="mx-auto w-12 h-12 text-blue-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Carregar Progresso via CSV
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Selecione o arquivo CSV com os dados de progresso das fases para das semanas que deseja atualizar
                  </p>
                </div>

                {/* Indicador de Progresso */}
                {uploadProgress && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {uploadProgress.message}
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {uploadProgress.total > 0 ? `${uploadProgress.current}/${uploadProgress.total}` : '...'}
                      </span>
                    </div>
                    {uploadProgress.total > 0 && (
                      <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Área de drag & drop / seleção de arquivo */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : selectedFile
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  
                  {selectedFile ? (
                    <div className="space-y-3">
                      <FileText className="mx-auto w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {!isUploading && (
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-sm text-red-600 hover:text-red-700 underline"
                      >
                        Remover arquivo
                      </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="mx-auto w-8 h-8 text-gray-400" />
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Clique para selecionar</span> ou arraste o arquivo CSV aqui
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Arquivo CSV até 5MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Download do modelo CSV */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Arquivo Modelo:
                  </h4>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    <p>• <span className="font-medium text-red-600">Colunas:</span> Projeto, Fase, Progresso, Progresso esperado, Ordem, Semana</p>
                    <p>• <span className="font-medium text-red-600">Fases:</span> Levantamento, Desenvolvimento, Homologação, Deploy, Acompanhamento</p>
                    <p>• <span className="font-medium text-green-600">Separadores:</span> Vírgula (,) ou Ponto e vírgula (;)</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-3">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <span className="font-semibold">⚠️ Importante sobre caracteres especiais (ç, ã, etc.):</span><br />
                      O sistema detecta automaticamente a codificação do arquivo. Se tiver problemas com acentuação, 
                      salve o arquivo CSV como <span className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">UTF-8</span> no Excel/LibreOffice 
                      (Salvar como → Ferramentas → Opções da Web → Codificação → UTF-8).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Criar conteúdo do CSV modelo
                      const csvContent = `Projeto;Fase;Progresso;Progresso esperado;Ordem;Semana
${project.name};Levantamento;0;0;1;1
${project.name};Desenvolvimento;0;0;2;1
${project.name};Homologação;0;0;3;1
${project.name};Deploy;0;0;4;1
${project.name};Acompanhamento;0;0;5;1
${project.name};Levantamento;0;0;1;2
${project.name};Desenvolvimento;0;0;2;2
${project.name};Homologação;0;0;3;2
${project.name};Deploy;0;0;4;2
${project.name};Acompanhamento;0;0;5;2`;
                      
                      // Adicionar BOM UTF-8 para melhor compatibilidade com Excel no Windows
                      const BOM = '\uFEFF';
                      const csvContentWithBOM = BOM + csvContent;
                      
                      // Criar blob e link de download
                      const blob = new Blob([csvContentWithBOM], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      const url = URL.createObjectURL(blob);
                      link.setAttribute('href', url);
                      link.setAttribute('download', 'Modelo_Progress.csv');
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Baixar Modelo CSV
                  </button>
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <p>💡 <strong>Dica:</strong> Use o modelo como base para criar seu arquivo de importação</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-between items-center">
            {!showUploadInterface ? (
              <>
                <div className="flex gap-3">
                  <button 
                    onClick={handleAddNewPhase}
                    className="px-4 py-2 text-sm text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Fase
                  </button>
                  <button 
                    onClick={handleAddAllPhases}
                    className="px-4 py-2 text-sm text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                     Todas as Fases
                  </button>
                  <button 
                    onClick={handleShowUploadInterface}
                    className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Carregar
                  </button>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleCloseModal}
                    className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSavePhases}
                    className="px-6 py-2 text-sm text-white font-semibold bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </>
            ) : (
              /* Footer para interface de upload */
              <>
                <div></div> {/* Espaço vazio à esquerda */}
                <div className="flex gap-3">
                  <button 
                    onClick={handleCloseUploadInterface}
                    className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleUploadCSV}
                    disabled={!selectedFile || isUploading}
                    className="px-6 py-2 text-sm text-white font-semibold bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Carregar
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteConfirmModalOpen && phaseToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deletar Fase do Projeto
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar a fase:
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    "{phaseToDelete.phase_name}"
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteConfirmModalOpen(false);
                  setPhaseToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeletePhase}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Fase
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectProgressModal;
