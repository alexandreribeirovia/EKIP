import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { 
  ArrowLeft, 
  FileText, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Save,
  X,
  GripVertical,
  Pencil
} from 'lucide-react';
import {
  DndContext,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EvaluationData, CategoryData, QuestionData, ReplyTypeOption } from '../types';

const EvaluationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [replyTypes, setReplyTypes] = useState<ReplyTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());
  const [newQuestionCategoryId, setNewQuestionCategoryId] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<CategoryData[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    description: '',
    reply_type_id: null as number | null,
    weight: 1,
    required: true,
  });
  
  // Estado para o modal de categoria com subcategorias
  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<number | null>(null);
  const [selectedSubcategoryForModal, setSelectedSubcategoryForModal] = useState<number | null>(null);
  const [subcategoriesForModal, setSubcategoriesForModal] = useState<CategoryData[]>([]);

  // Estado para controlar o item sendo arrastado (para DragOverlay)
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeType, setActiveType] = useState<'category' | 'subcategory' | 'question' | null>(null);

  // Estado para controlar edição de pergunta
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState({
    question: '',
    description: '',
    reply_type_id: null as number | null,
    weight: 1,
    required: true,
  });

  // ❌ REMOVIDO handleQuestionFormChange - não usado mais (estado local no NewQuestionForm)
  // ❌ REMOVIDO handleEditQuestionFormChange - não sincroniza mais no blur
  // Estado local é usado durante edição, sincronização apenas no save

  // Salvar e restaurar posição do scroll após re-renders + Prevenir auto-scroll
  const scrollPositionRef = React.useRef<number>(0);
  
  useEffect(() => {
    // PREVENIR AUTO-SCROLL DO NAVEGADOR
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);
  
  useEffect(() => {
    // Salvar posição do scroll antes do re-render
    scrollPositionRef.current = window.scrollY;
  });

  useEffect(() => {
    // Restaurar posição do scroll após o re-render
    const savedScroll = scrollPositionRef.current;
    
    if (savedScroll > 0) {
      window.scrollTo(0, savedScroll);
    }
  });

  // Buscar dados da avaliação
  const fetchEvaluation = async () => {
    if (!id) return;
    
    try {
      const response = await apiClient.get<EvaluationData>(`/api/evaluations/${id}`);

      if (!response.success) {
        console.error('Erro ao buscar avaliação:', response.error);
        return;
      }

      setEvaluation(response.data || null);
    } catch (err) {
      console.error('Erro ao buscar avaliação:', err);
    }
  };

  // Buscar categorias vinculadas à avaliação através das perguntas
  const fetchCategories = async () => {
    if (!id) return;
    
    try {
      // Buscar categorias usadas nesta avaliação via API
      const response = await apiClient.get<CategoryData[]>(`/api/evaluations/${id}/categories`);

      if (!response.success) {
        console.error('Erro ao buscar categorias:', response.error);
        return;
      }

      const data = response.data || [];

      if (data.length === 0) {
        setCategories([]);
        setExpandedCategories(new Set());
        return;
      }

      // Extrair IDs únicos de categorias
      const categoryIds = new Set<number>();
      data.forEach((item: CategoryData) => {
        if (item.type === 'evaluation_category') {
          categoryIds.add(item.id);
        }
      });

      setCategories(data);
      
      // Expandir todas as categorias APENAS na primeira carga
      // (quando ainda não há nenhuma categoria expandida)
      // Subcategorias ficam fechadas por padrão
      setExpandedCategories(prev => {
        if (prev.size === 0) {
          return new Set(categoryIds);
        }
        return prev;
      });
      
      // Subcategorias começam fechadas - não expandir automaticamente
      setExpandedSubcategories(prev => {
        if (prev.size === 0) {
          return new Set(); // Set vazio = todas fechadas
        }
        return prev;
      });
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  // Buscar tipos de resposta
  const fetchReplyTypes = async () => {
    try {
      const response = await apiClient.get<ReplyTypeOption[]>('/api/evaluations/reply-types');

      if (!response.success) {
        console.error('Erro ao buscar tipos de resposta:', response.error);
        return;
      }

      setReplyTypes(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar tipos de resposta:', err);
    }
  };

  // Buscar perguntas vinculadas a esta avaliação
  const fetchQuestions = async () => {
    if (!id) return;
    
    try {
      // Buscar perguntas via API
      const response = await apiClient.get<QuestionData[]>(`/api/evaluations/${id}/questions`);

      if (!response.success) {
        console.error('Erro ao buscar perguntas:', response.error);
        return;
      }

      setQuestions(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar perguntas:', err);
    }
  };

  // Buscar categorias disponíveis
  // Uma categoria pode ser adicionada múltiplas vezes com subcategorias diferentes
  const fetchAvailableCategories = async () => {
    if (!id) return;
    
    try {
      // Buscar todas as categorias ativas via API
      const response = await apiClient.get<CategoryData[]>('/api/evaluations/categories');

      if (!response.success) {
        console.error('Erro ao buscar todas as categorias:', response.error);
        return;
      }

      // MUDANÇA: Permitir adicionar a mesma categoria múltiplas vezes
      // (com subcategorias diferentes ou sem subcategoria)
      // Todas as categorias ficam sempre disponíveis
      setAvailableCategories(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar categorias disponíveis:', err);
    }
  };

  // Função para mostrar subcategorias quando uma categoria é selecionada no modal
  const handleCategorySelection = async (categoryId: number) => {
    setSelectedCategoryForModal(categoryId);
    
    // Buscar subcategorias desta categoria via API
    const response = await apiClient.get<CategoryData[]>(`/api/evaluations/categories/${categoryId}/subcategories`);

    if (!response.success) {
      console.error('Erro ao buscar subcategorias:', response.error);
      setSubcategoriesForModal([]);
    } else {
      setSubcategoriesForModal(response.data || []);
    }
  };

  // Adicionar uma nova categoria à avaliação (com subcategoria opcional)
  const handleAddCategory = async (categoryId: number, subcategoryId: number | null = null) => {
    setShowCategoryModal(false);
    setSelectedCategoryForModal(null);
    setSelectedSubcategoryForModal(null);
    setSubcategoriesForModal([]);
    
    // Buscar a categoria selecionada
    const selectedCategory = availableCategories.find(c => c.id === categoryId);
    
    if (!selectedCategory) {
      return;
    }
    
    // Buscar subcategorias desta categoria (para adicionar ao state) via API
    const subcatsResponse = await apiClient.get<CategoryData[]>(`/api/evaluations/categories/${categoryId}/subcategories`);
    const subcats = subcatsResponse.success ? subcatsResponse.data || [] : [];

    if (!subcatsResponse.success) {
      console.error('Erro ao buscar subcategorias:', subcatsResponse.error);
    }
    
    // Adicionar a categoria e suas subcategorias temporariamente ao array de categorias
    setCategories(prev => [...prev, selectedCategory, ...(subcats || [])]);
    
    // Expandir a categoria
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      newSet.add(categoryId);
      return newSet;
    });
    
    // Expandir a subcategoria se foi selecionada
    if (subcategoryId) {
      setExpandedSubcategories(prev => {
        const newSet = new Set(prev);
        newSet.add(subcategoryId);
        return newSet;
      });
    }
    
    // Abre automaticamente o formulário de adicionar pergunta para esta categoria/subcategoria
    handleAddQuestion(categoryId, subcategoryId);
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchEvaluation(),
        fetchReplyTypes(),
        fetchQuestions(),
      ]);
      await fetchCategories(); // Executar depois para ter as perguntas carregadas
      setIsLoading(false);
    };
    
    void loadData();
  }, [id]);

  // Toggle categoria expandida/colapsada
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle subcategoria expandida/colapsada
  const toggleSubcategory = (subcategoryId: number) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  // Obter categorias principais com ordem
  const mainCategories = categories
    .filter(c => c.type === 'evaluation_category')
    .map(cat => {
      // Pegar a menor category_order das perguntas desta categoria
      const categoryQuestions = questions.filter(q => q.category_id === cat.id);
      const minOrder = categoryQuestions.length > 0 
        ? Math.min(...categoryQuestions.map(q => q.category_order))
        : 0;
      return { ...cat, order: minOrder };
    })
    .sort((a, b) => a.order - b.order);

  // Incluir categoria temporária se estiver adicionando uma pergunta para uma categoria nova
  const displayCategories = [...mainCategories];
  if (newQuestionCategoryId && !mainCategories.find(c => c.id === newQuestionCategoryId)) {
    // Buscar a categoria no categories (acabamos de adicionar) ou availableCategories
    const tempCategory = categories.find(c => c.id === newQuestionCategoryId && c.type === 'evaluation_category') 
      || availableCategories.find(c => c.id === newQuestionCategoryId);
    
    if (tempCategory) {
      displayCategories.push({ ...tempCategory, order: mainCategories.length });
    }
  }

  // Obter subcategorias de uma categoria
  const getSubcategories = (categoryId: number) => {
    return categories.filter(c => c.type === 'evaluation_subcategory' && c.parent_id === categoryId);
  };

  // Obter perguntas de uma categoria ordenadas
  const getQuestionsByCategory = (categoryId: number) => {
    return questions
      .filter(q => q.category_id === categoryId)
      .sort((a, b) => a.question_order - b.question_order);
  };

  // Atualizar ordem da categoria
  const updateCategoryOrder = async (categoryId: number, newOrder: number) => {
    if (!id) return;
    
    try {
      // Atualizar todas as perguntas da categoria com a nova ordem via batch
      const categoryQuestions = questions.filter(q => q.category_id === categoryId);
      const questionsToReorder = categoryQuestions
        .filter(q => q.evaluation_question_id)
        .map(q => ({
          evaluation_question_id: q.evaluation_question_id,
          category_order: newOrder
        }));
      
      if (questionsToReorder.length > 0) {
        const response = await apiClient.put(`/api/evaluations/${id}/questions/reorder`, {
          questions: questionsToReorder
        });
        
        if (!response.success) {
          console.error('Erro ao atualizar ordem da categoria:', response.error);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar ordem da categoria:', err);
    }
  };

  // Atualizar ordem das perguntas
  const updateQuestionOrder = async (evaluationQuestionId: number, newOrder: number) => {
    if (!id) return;
    
    try {
      const response = await apiClient.put(`/api/evaluations/${id}/questions/reorder`, {
        questions: [{ evaluation_question_id: evaluationQuestionId, question_order: newOrder }]
      });

      if (!response.success) {
        console.error('Erro ao atualizar ordem da pergunta:', response.error);
      }
    } catch (err) {
      console.error('Erro ao atualizar ordem da pergunta:', err);
    }
  };

  // Atualizar ordem da subcategoria
  const updateSubcategoryOrder = async (categoryId: number, subcategoryId: number, newOrder: number) => {
    if (!id) return;
    
    try {
      // Atualizar todas as perguntas dessa subcategoria com a nova ordem via batch
      const subcategoryQuestions = questions.filter(
        q => q.category_id === categoryId && q.subcategory_id === subcategoryId
      );
      
      const questionsToReorder = subcategoryQuestions
        .filter(q => q.evaluation_question_id)
        .map(q => ({
          evaluation_question_id: q.evaluation_question_id,
          subcategory_order: newOrder
        }));
      
      if (questionsToReorder.length > 0) {
        const response = await apiClient.put(`/api/evaluations/${id}/questions/reorder`, {
          questions: questionsToReorder
        });
        
        if (!response.success) {
          console.error('Erro ao atualizar ordem da subcategoria:', response.error);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar ordem da subcategoria:', err);
    }
  };

  // Handler unificado para drag-and-drop (categorias E perguntas)
  const handleUnifiedDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Verificar se está arrastando uma categoria, subcategoria ou pergunta
    const isDraggingCategory = mainCategories.some(cat => cat.id === active.id);
    const isDraggingSubcategory = categories.some(cat => cat.parent_id !== null && cat.id === active.id);
    const isDraggingQuestion = questions.some(q => q.id === active.id);
    
    if (isDraggingCategory) {
      // Handler para categorias
      const oldIndex = mainCategories.findIndex(cat => cat.id === active.id);
      const newIndex = mainCategories.findIndex(cat => cat.id === over.id);

      // Reordenar localmente
      const reorderedCategories = arrayMove(mainCategories, oldIndex, newIndex);

      // Atualizar no banco de dados - atualizar todas as perguntas de todas as categorias
      for (let categoryIndex = 0; categoryIndex < reorderedCategories.length; categoryIndex++) {
        const category = reorderedCategories[categoryIndex];
        await updateCategoryOrder(category.id, categoryIndex);
      }

      // Recarregar perguntas para atualizar a ordem
      await fetchQuestions();
    } else if (isDraggingSubcategory) {
      // Handler para subcategorias
      await handleSubcategoryDragEnd(event);
    } else if (isDraggingQuestion) {
      // Handler para perguntas
      await handleQuestionDragEnd(event);
    }
  };

  // Handler para reordenar perguntas (agora suporta mover entre categorias/subcategorias)
  const handleQuestionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeQuestion = questions.find(q => q.id === active.id);
    if (!activeQuestion) {
      return;
    }

    // Verificar se soltou sobre outra pergunta
    const overQuestion = questions.find(q => q.id === over.id);
    
    if (!overQuestion) {
      return;
    }

    if (active.id === over.id) {
      return;
    }

    const oldCategoryId = activeQuestion.category_id;
    const oldSubcategoryId = activeQuestion.subcategory_id;
    const newCategoryId = overQuestion.category_id;
    const newSubcategoryId = overQuestion.subcategory_id;

    // Verificar se é movimento dentro da mesma categoria/subcategoria ou entre diferentes
    const isSameContainer = 
      oldCategoryId === newCategoryId && 
      oldSubcategoryId === newSubcategoryId;

    try {
      if (isSameContainer) {
        // Movimento dentro do mesmo container - apenas reordenar
        const containerQuestions = questions.filter(
          q => q.category_id === newCategoryId && q.subcategory_id === newSubcategoryId
        ).sort((a, b) => a.question_order - b.question_order);

        const oldIndex = containerQuestions.findIndex(q => q.id === active.id);
        const newIndex = containerQuestions.findIndex(q => q.id === over.id);

        const reorderedQuestions = arrayMove(containerQuestions, oldIndex, newIndex);

        // Atualizar ordem das perguntas
        for (let i = 0; i < reorderedQuestions.length; i++) {
          if (reorderedQuestions[i].evaluation_question_id) {
            await updateQuestionOrder(reorderedQuestions[i].evaluation_question_id!, i);
          }
        }
      } else {
        // Movimento entre diferentes categorias/subcategorias
        const newCategory = categories.find(c => c.id === newCategoryId);
        const newSubcategory = categories.find(c => c.id === newSubcategoryId);

        // 1. Obter o maior subcategory_order do container de destino
        const destQuestions = questions.filter(q => 
          q.category_id === newCategoryId && 
          q.subcategory_id === newSubcategoryId &&
          q.id !== activeQuestion.id
        ).sort((a, b) => a.question_order - b.question_order);

        const overQuestionIndex = destQuestions.findIndex(q => q.id === over.id);
        const newQuestionOrder = overQuestionIndex >= 0 ? overQuestion.question_order : 0;

        // Obter o category_order correto
        const newCategoryOrder = overQuestion.category_order;
        
        // Obter o subcategory_order correto
        let newSubcategoryOrder = 0;
        if (newSubcategoryId) {
          newSubcategoryOrder = overQuestion.subcategory_order;
        }

        // 2. Atualizar pergunta e ordem via batch API
        const reorderResponse = await apiClient.put(`/api/evaluations/${id}/questions/reorder`, {
          questions: [{
            evaluation_question_id: activeQuestion.evaluation_question_id,
            question_id: activeQuestion.id,
            category_id: newCategoryId,
            subcategory_id: newSubcategoryId,
            category: newCategory?.value || activeQuestion.category,
            subcategory: newSubcategory?.value || null,
            category_order: newCategoryOrder,
            subcategory_order: newSubcategoryOrder,
            question_order: newQuestionOrder,
          }]
        });

        if (!reorderResponse.success) {
          console.error('Erro ao mover pergunta:', reorderResponse.error);
          return;
        }

        // 3. Reordenar todas as perguntas do container de destino
        const questionsToReorder = [...destQuestions];
        questionsToReorder.splice(overQuestionIndex + 1, 0, activeQuestion);

        for (let i = 0; i < questionsToReorder.length; i++) {
          if (questionsToReorder[i].evaluation_question_id) {
            await updateQuestionOrder(questionsToReorder[i].evaluation_question_id!, i);
          }
        }
      }

      // Recarregar dados
      await fetchQuestions();
      await fetchCategories();
    } catch (error) {
      console.error('Erro ao mover pergunta:', error);
    }
  };

  // Handler para reordenar subcategorias dentro de uma categoria
  const handleSubcategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeSubcategory = categories.find(c => c.id === active.id);
    const overSubcategory = categories.find(c => c.id === over.id);

    if (!activeSubcategory || !overSubcategory) {
      return;
    }

    const activeCategoryId = activeSubcategory.parent_id;
    const overCategoryId = overSubcategory.parent_id;
    
    if (!activeCategoryId || !overCategoryId) {
      return;
    }

    // VERIFICAR: Só pode mover subcategorias dentro da mesma categoria
    if (activeCategoryId !== overCategoryId) {
      console.warn('Não é possível mover subcategorias entre categorias diferentes');
      return;
    }

    // Pegar todas as subcategorias desta categoria que têm perguntas, ordenadas
    const subcategoriesWithQuestions = categories
      .filter(c => 
        c.parent_id === activeCategoryId && 
        questions.some(q => q.subcategory_id === c.id)
      )
      .map(sub => {
        // Pegar a menor subcategory_order das perguntas desta subcategoria
        const subcatQuestions = questions.filter(q => q.subcategory_id === sub.id);
        const minOrder = subcatQuestions.length > 0 
          ? Math.min(...subcatQuestions.map(q => q.subcategory_order))
          : 0;
        return { ...sub, order: minOrder };
      })
      .sort((a, b) => a.order - b.order);

    const oldIndex = subcategoriesWithQuestions.findIndex(sub => sub.id === active.id);
    const newIndex = subcategoriesWithQuestions.findIndex(sub => sub.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reordenar usando arrayMove
    const reorderedSubcategories = arrayMove(subcategoriesWithQuestions, oldIndex, newIndex);

    // Atualizar no banco de dados - dar novas ordens sequenciais para todas
    for (let i = 0; i < reorderedSubcategories.length; i++) {
      const subcategory = reorderedSubcategories[i];
      await updateSubcategoryOrder(activeCategoryId, subcategory.id, i);
    }

    // Recarregar perguntas para atualizar a ordem
    await fetchQuestions();
  };

  // Configurar sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Função de detecção de colisão customizada
  const customCollisionDetection = (args: any) => {
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      const isDraggingQuestion = questions.some(q => q.id === args.active.id);
      const isDraggingSubcategory = categories.some(c => c.parent_id !== null && c.id === args.active.id);
      
      if (isDraggingQuestion) {
        // Priorizar colisões com perguntas
        const questionCollisions = pointerCollisions.filter(collision => 
          questions.some(q => q.id === collision.id)
        );
        
        if (questionCollisions.length > 0) {
          return questionCollisions;
        }
      }
      
      if (isDraggingSubcategory) {
        // Para subcategorias, só permitir colisão com outras subcategorias da mesma categoria
        const activeSubcat = categories.find(c => c.id === args.active.id);
        if (activeSubcat && activeSubcat.parent_id) {
          const validCollisions = pointerCollisions.filter(collision => {
            const overSubcat = categories.find(c => c.id === collision.id);
            // Só permitir colisão com subcategorias da mesma categoria pai
            return overSubcat && overSubcat.parent_id === activeSubcat.parent_id;
          });
          
          if (validCollisions.length > 0) {
            return validCollisions;
          }
          
          // Se não encontrou colisões válidas, retornar vazio para impedir o drop
          return [];
        }
      }
      
      return pointerCollisions;
    }
    
    // Se não encontrou com pointerWithin, usa closestCorners como fallback
    return closestCorners(args);
  };

  // Adicionar nova pergunta (agora recebe subcategoryId também)
  const handleAddQuestion = (categoryId: number, subcategoryId: number | null = null) => {
    setNewQuestionCategoryId(categoryId);
    setSelectedSubcategoryForModal(subcategoryId);
    setQuestionForm({
      question: '',
      description: '',
      reply_type_id: replyTypes.length > 0 ? replyTypes[0].id : null,
      weight: 1,
      required: true,
    });
  };

  // Salvar nova pergunta
  const handleSaveNewQuestion = async (
    categoryId: number,
    overrideQuestion?: string,
    overrideDescription?: string,
    overrideReplyTypeId?: number | null,
    overrideWeight?: number,
    overrideRequired?: boolean
  ) => {
    // Usar valores passados ou valores do estado global
    const question = overrideQuestion !== undefined ? overrideQuestion : questionForm.question;
    const description = overrideDescription !== undefined ? overrideDescription : questionForm.description;
    const replyTypeId = overrideReplyTypeId !== undefined ? overrideReplyTypeId : questionForm.reply_type_id;
    const weight = overrideWeight !== undefined ? overrideWeight : questionForm.weight;
    const required = overrideRequired !== undefined ? overrideRequired : questionForm.required;

    if (!question.trim()) {
      alert('Por favor, preencha a pergunta.');
      return;
    }

    if (!replyTypeId) {
      alert('Por favor, selecione o tipo de resposta.');
      return;
    }

    // Verificar se o tipo selecionado é texto
    const selectedType = replyTypes.find(t => t.id === replyTypeId);
    const isTextType = selectedType?.value.toLowerCase().includes('texto');

    // Validar peso: se não for texto, deve ser >= 1; se for texto, deve ser 0
    if (!isTextType && weight < 1) {
      alert('O peso deve ser maior ou igual a 1.');
      return;
    }

    if (isTextType && weight !== 0) {
      alert('O peso deve ser 0 para perguntas do tipo texto.');
      return;
    }

    if (!id) {
      alert('ID da avaliação não encontrado.');
      return;
    }

    try {
      // Buscar categoria (pode estar em categories ou availableCategories)
      let category = categories.find(c => c.id === categoryId);
      if (!category) {
        category = availableCategories.find(c => c.id === categoryId);
      }
      
      // Usar a subcategoria do estado (selecionada no modal)
      const subcategory = selectedSubcategoryForModal 
        ? categories.find(c => c.id === selectedSubcategoryForModal)
        : null;

      const allQuestions = questions;
      
      // CORRIGIDO: Calcular ordem da categoria
      // Verificar se esta categoria já existe (tem perguntas)
      const existingCategoryQuestions = allQuestions.filter(q => q.category_id === categoryId);
      let nextCategoryOrder: number;
      
      if (existingCategoryQuestions.length > 0) {
        // Se a categoria já existe, usar a mesma category_order
        nextCategoryOrder = existingCategoryQuestions[0].category_order;
      } else {
        // Se é uma categoria nova, adicionar por último
        const allCategoryOrders = allQuestions.map(q => q.category_order);
        nextCategoryOrder = allCategoryOrders.length > 0
          ? Math.max(...allCategoryOrders) + 1
          : 0;
      }
      
      // CORRIGIDO: Calcular ordem da subcategoria
      let nextSubcategoryOrder = 0;
      if (selectedSubcategoryForModal) {
        const existingSubcategoryQuestions = allQuestions.filter(
          q => q.category_id === categoryId && q.subcategory_id === selectedSubcategoryForModal
        );
        
        if (existingSubcategoryQuestions.length > 0) {
          // Se a subcategoria já existe, usar a mesma subcategory_order
          nextSubcategoryOrder = existingSubcategoryQuestions[0].subcategory_order;
        } else {
          // Se é uma subcategoria nova, adicionar por último dentro da categoria
          const allSubcategoryOrdersInCategory = allQuestions
            .filter(q => q.category_id === categoryId && q.subcategory_id !== null)
            .map(q => q.subcategory_order);
          nextSubcategoryOrder = allSubcategoryOrdersInCategory.length > 0
            ? Math.max(...allSubcategoryOrdersInCategory) + 1
            : 0;
        }
      }

      // Calcular a próxima ordem da pergunta dentro do container (categoria ou subcategoria)
      const categoryQuestions = getQuestionsByCategory(categoryId);
      const containerQuestions = selectedSubcategoryForModal
        ? categoryQuestions.filter(q => q.subcategory_id === selectedSubcategoryForModal)
        : categoryQuestions.filter(q => q.subcategory_id === null);
      
      const nextQuestionOrder = containerQuestions.length > 0
        ? Math.max(...containerQuestions.map(q => q.question_order)) + 1
        : 0;

      // Criar pergunta via API (inclui criação da pergunta + vínculo com a avaliação)
      const response = await apiClient.post(`/api/evaluations/${id}/questions`, {
        question: question.trim(),
        description: description.trim() || null,
        category: category?.value || '',
        subcategory: subcategory?.value || '',
        category_id: categoryId,
        subcategory_id: selectedSubcategoryForModal,
        weight: weight,
        required: required,
        reply_type_id: replyTypeId,
        category_order: nextCategoryOrder,
        subcategory_order: nextSubcategoryOrder,
        question_order: nextQuestionOrder,
      });

      if (!response.success) {
        console.error('Erro ao criar pergunta:', response.error);
        alert('Erro ao criar pergunta. Tente novamente.');
        return;
      }

      // Recarrega as perguntas e categorias
      await fetchQuestions();
      await fetchCategories();
      
      // Garantir que a categoria onde a pergunta foi adicionada está expandida
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        newSet.add(categoryId);
        return newSet;
      });
      
      // Se adicionou em uma subcategoria, expandir também
      if (selectedSubcategoryForModal) {
        setExpandedSubcategories(prev => {
          const newSet = new Set(prev);
          newSet.add(selectedSubcategoryForModal);
          return newSet;
        });
      }
      
      // Limpa o formulário
      setNewQuestionCategoryId(null);
      setSelectedSubcategoryForModal(null);
      setQuestionForm({
        question: '',
        description: '',
        reply_type_id: replyTypes.length > 0 ? replyTypes[0].id : null,
        weight: 1,
        required: true,
      });
    } catch (err) {
      console.error('Erro ao criar pergunta:', err);
      alert('Erro ao criar pergunta. Tente novamente.');
    }
  };

  // Cancelar adição de pergunta
  const handleCancelNewQuestion = () => {
    const categoryId = newQuestionCategoryId;
    
    // Se estava adicionando uma pergunta para uma categoria nova (sem perguntas existentes)
    // então devemos remover essa categoria do state
    if (categoryId) {
      const categoryQuestions = questions.filter(q => q.category_id === categoryId);
      
      if (categoryQuestions.length === 0) {
        // Remove a categoria e suas subcategorias do state
        setCategories(prev => prev.filter(c => 
          c.id !== categoryId && c.parent_id !== categoryId
        ));
        
        // Remove das categorias expandidas
        setExpandedCategories(prev => {
          const newSet = new Set(prev);
          newSet.delete(categoryId);
          return newSet;
        });
      }
    }
    
    setNewQuestionCategoryId(null);
    setSelectedSubcategoryForModal(null);
    setQuestionForm({
      question: '',
      description: '',
      reply_type_id: replyTypes.length > 0 ? replyTypes[0].id : null,
      weight: 1,
      required: true,
    });
  };

  // Abrir modal de confirmação de exclusão
  const handleDeleteQuestion = useCallback((questionId: number) => {
    setQuestionToDelete(questionId);
    setShowDeleteModal(true);
  }, []);

  // Confirmar exclusão da pergunta
  const confirmDeleteQuestion = async () => {
    if (!questionToDelete || !id) return;

    try {
      // Deletar pergunta via API (backend remove vínculo + pergunta)
      const response = await apiClient.delete(`/api/evaluations/${id}/questions/${questionToDelete}`);

      if (!response.success) {
        console.error('Erro ao deletar pergunta:', response.error);
        alert('Erro ao deletar pergunta. Tente novamente.');
        return;
      }

      // Recarrega as perguntas e categorias
      await fetchQuestions();
      await fetchCategories();
      
      // Fecha o modal
      setShowDeleteModal(false);
      setQuestionToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar pergunta:', err);
      alert('Erro ao deletar pergunta. Tente novamente.');
    }
  };

  // Cancelar exclusão da pergunta
  const cancelDeleteQuestion = () => {
    setShowDeleteModal(false);
    setQuestionToDelete(null);
  };

  // Iniciar edição de uma pergunta
  const handleEditQuestion = useCallback((question: QuestionData) => {
    setEditingQuestionId(question.id);
    setEditQuestionForm({
      question: question.question,
      description: question.description || '',
      reply_type_id: question.reply_type_id,
      weight: question.weight,
      required: question.required,
    });
  }, []);

  // Salvar edição da pergunta
  const handleSaveEditQuestion = useCallback(async (
    overrideQuestion?: string, 
    overrideDescription?: string,
    overrideReplyTypeId?: number | null,
    overrideWeight?: number,
    overrideRequired?: boolean
  ) => {
    if (!editingQuestionId) return;

    // Usar valores override se fornecidos, senão usar editQuestionForm
    const questionToSave = overrideQuestion !== undefined ? overrideQuestion : editQuestionForm.question;
    const descriptionToSave = overrideDescription !== undefined ? overrideDescription : editQuestionForm.description;
    const replyTypeIdToSave = overrideReplyTypeId !== undefined ? overrideReplyTypeId : editQuestionForm.reply_type_id;
    const weightToSave = overrideWeight !== undefined ? overrideWeight : editQuestionForm.weight;
    const requiredToSave = overrideRequired !== undefined ? overrideRequired : editQuestionForm.required;

    if (!questionToSave.trim()) {
      alert('Por favor, preencha a pergunta.');
      return;
    }

    if (!replyTypeIdToSave) {
      alert('Por favor, selecione o tipo de resposta.');
      return;
    }

    // Verificar se o tipo selecionado é texto
    const selectedType = replyTypes.find(t => t.id === replyTypeIdToSave);
    const isTextType = selectedType?.value.toLowerCase().includes('texto');

    // Validar peso
    if (!isTextType && weightToSave < 1) {
      alert('O peso deve ser maior ou igual a 1.');
      return;
    }

    if (isTextType && weightToSave !== 0) {
      alert('O peso deve ser 0 para perguntas do tipo texto.');
      return;
    }

    try {
      // Atualizar a pergunta via API
      const response = await apiClient.put(`/api/evaluations/${id}/questions/${editingQuestionId}`, {
        question: questionToSave.trim(),
        description: descriptionToSave.trim() || null,
        reply_type_id: replyTypeIdToSave,
        weight: weightToSave,
        required: requiredToSave,
      });

      if (!response.success) {
        console.error('Erro ao atualizar pergunta:', response.error);
        alert('Erro ao atualizar pergunta. Tente novamente.');
        return;
      }



      // Recarregar perguntas
      await fetchQuestions();

      // Limpar estado de edição
      setEditingQuestionId(null);
      setEditQuestionForm({
        question: '',
        description: '',
        reply_type_id: null,
        weight: 1,
        required: true,
      });
    } catch (err) {
      console.error('Erro ao atualizar pergunta:', err);
      alert('Erro ao atualizar pergunta. Tente novamente.');
    }
  }, [editingQuestionId, editQuestionForm, replyTypes]);

  // Cancelar edição da pergunta
  const handleCancelEditQuestion = useCallback(() => {
    setEditingQuestionId(null);
    setEditQuestionForm({
      question: '',
      description: '',
      reply_type_id: null,
      weight: 1,
      required: true,
    });
  }, []);

  // Função auxiliar para agrupar perguntas por subcategoria
  const groupQuestionsBySubcategory = (categoryQuestions: QuestionData[]) => {
    const grouped = new Map<number | null, QuestionData[]>();
    
    categoryQuestions.forEach(question => {
      const subcatId = question.subcategory_id;
      if (!grouped.has(subcatId)) {
        grouped.set(subcatId, []);
      }
      grouped.get(subcatId)!.push(question);
    });
    
    return grouped;
  };

  // Componente para item de subcategoria arrastável
  interface SortableSubcategoryItemProps {
    subcategory: CategoryData;
    subcatQuestions: QuestionData[];
    categoryId: number;
    isAddingQuestion: boolean;
    isExpanded: boolean;
  }

  const SortableSubcategoryItem = ({ 
    subcategory, 
    subcatQuestions,
    categoryId,
    isAddingQuestion,
    isExpanded,
  }: SortableSubcategoryItemProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: subcategory.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className={`border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden ${
        isDragging ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-lg' : ''
      }`}>
        {/* Header da Subcategoria */}
        <div 
          className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 flex items-center gap-2 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 transition-colors cursor-pointer"
          onClick={() => toggleSubcategory(subcategory.id)}
        >
          {!isExpanded ? (
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
              title="Arrastar para reordenar subcategoria (expanda para desabilitar)"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          ) : (
            <div className="p-1 text-blue-300 dark:text-blue-600 opacity-30" title="Recolha a subcategoria para reordená-la">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2 flex-1">
            <span className="text-blue-500 dark:text-blue-400">•</span>
            {subcategory.value}
            <span className="text-xs text-blue-700 dark:text-blue-300 font-normal">
              ({subcatQuestions.length} {subcatQuestions.length === 1 ? 'pergunta' : 'perguntas'})
            </span>
          </h4>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        
        {/* Perguntas da Subcategoria */}
        {isExpanded && (
          <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 space-y-2">
            <div className="space-y-2">
              {subcatQuestions.map((question, index) => {
                return (
                  <SortableQuestionItem
                    key={question.id}
                    question={question}
                    index={index}
                    onDelete={handleDeleteQuestion}
                  />
                );
              })}
            </div>
          
            {/* Botão para adicionar pergunta nesta subcategoria */}
            {!isAddingQuestion && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddQuestion(categoryId, subcategory.id);
                }}
                className="w-full px-3 py-2 text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2 border border-dashed border-blue-300 dark:border-blue-700"
              >
                <Plus className="w-3 h-3" />
                Adicionar Pergunta
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Componente para item de categoria arrastável com subcategorias
  interface SortableCategoryItemProps {
    category: any;
    isExpanded: boolean;
    categoryQuestions: QuestionData[];
    subcategories: CategoryData[];
    isAddingQuestion: boolean;
  }

  // ========== NEW QUESTION FORM COMPONENT (with local state) ==========
  const NewQuestionForm = React.memo(({ 
    categoryId,
    selectedSubcategoryForModal,
    questionForm,
    replyTypes,
    categories,
    onSave,
    onCancel
  }: {
    categoryId: number;
    selectedSubcategoryForModal: number | null;
    questionForm: any;
    replyTypes: any[];
    categories: CategoryData[];
    onSave: (question: string, description: string, replyTypeId: number | null, weight: number, required: boolean) => void;
    onCancel: () => void;
  }) => {
    // ✅ ESTADO LOCAL - não causa re-render do componente pai
    const [localQuestion, setLocalQuestion] = React.useState(questionForm.question);
    const [localDescription, setLocalDescription] = React.useState(questionForm.description);
    const [localReplyTypeId, setLocalReplyTypeId] = React.useState(questionForm.reply_type_id);
    const [localWeight, setLocalWeight] = React.useState(questionForm.weight);
    const [localRequired, setLocalRequired] = React.useState(questionForm.required);

    const selectedReplyType = replyTypes.find(t => t.id === localReplyTypeId);
    const isTextType = selectedReplyType?.value?.toLowerCase().includes('texto');

    const handleSave = () => {
      onSave(localQuestion, localDescription, localReplyTypeId, localWeight, localRequired);
    };

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/10 rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700">
        <div className="space-y-3">
          {selectedSubcategoryForModal && (
            <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
              <strong>Subcategoria:</strong> {categories.find(c => c.id === selectedSubcategoryForModal)?.value || 'N/A'}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pergunta <span className="text-red-500">*</span>
            </label>
            <input
              id={`new-question-input-${categoryId}-${selectedSubcategoryForModal || 'none'}`}
              name="new_question"
              type="text"
              value={localQuestion}
              onChange={(e) => setLocalQuestion(e.target.value)}
              placeholder="Digite a pergunta..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <textarea
              id={`new-description-input-${categoryId}-${selectedSubcategoryForModal || 'none'}`}
              name="new_description"
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              placeholder="Adicione uma descrição ou contexto para a pergunta (opcional)..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Resposta <span className="text-red-500">*</span>
              </label>
              <select
                value={localReplyTypeId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value ? parseInt(e.target.value) : null;
                  const selectedType = replyTypes.find(t => t.id === selectedId);
                  const isText = selectedType?.value.toLowerCase().includes('texto');
                  
                  setLocalReplyTypeId(selectedId);
                  if (isText) {
                    setLocalWeight(0);
                  } else if (localWeight === 0) {
                    setLocalWeight(1);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              >
                <option value="">Selecione...</option>
                {replyTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Peso {isTextType ? (
                  <span className="text-xs text-gray-500">(fixo em 0 para texto)</span>
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                type="number"
                min="0"
                value={localWeight}
                onChange={(e) => setLocalWeight(parseInt(e.target.value) || 0)}
                disabled={isTextType}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm ${
                  isTextType 
                    ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' 
                    : 'bg-white dark:bg-gray-800'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={localRequired}
                onChange={(e) => setLocalRequired(e.target.checked)}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">Obrigatória</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 font-medium bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm text-white font-medium bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Salvar Pergunta
            </button>
          </div>
        </div>
      </div>
    );
  });

  const SortableCategoryItem = ({ 
    category, 
    isExpanded, 
    categoryQuestions,
    subcategories,
    isAddingQuestion,
  }: SortableCategoryItemProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: category.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
    };

    // Agrupar perguntas por subcategoria
    const questionsBySubcategory = groupQuestionsBySubcategory(categoryQuestions);
    const questionsWithoutSubcategory = questionsBySubcategory.get(null) || [];
    
    // Subcategorias que têm perguntas, ordenadas por subcategory_order
    const subcatsWithQuestions = subcategories
      .filter(sub => 
        questionsBySubcategory.has(sub.id) && questionsBySubcategory.get(sub.id)!.length > 0
      )
      .map(sub => {
        // Pegar a menor subcategory_order das perguntas desta subcategoria
        const subcatQuestions = questionsBySubcategory.get(sub.id) || [];
        const minOrder = subcatQuestions.length > 0 
          ? Math.min(...subcatQuestions.map(q => q.subcategory_order))
          : 0;
        return { ...sub, order: minOrder };
      })
      .sort((a, b) => a.order - b.order);

    return (
      <div ref={setNodeRef} style={style}>
        <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
          isDragging ? 'ring-2 ring-orange-500 ring-opacity-50 shadow-lg' : ''
        }`}>
          {/* Header da Categoria */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 flex items-center justify-between hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-900/30 dark:hover:to-orange-800/30 transition-colors cursor-pointer" onClick={() => toggleCategory(category.id)}>
            <div className="flex items-center gap-3 flex-1">
              <button
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 p-1"
                title="Arrastar para reordenar"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                {category.value}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-orange-700 dark:text-orange-300">
                {categoryQuestions.length} {categoryQuestions.length === 1 ? 'pergunta' : 'perguntas'}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>
          </div>

          {/* Conteúdo da Categoria */}
          {isExpanded && (
            <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
              {/* Perguntas sem subcategoria */}
              {questionsWithoutSubcategory.length > 0 && (
                <div className="space-y-2">
                  {questionsWithoutSubcategory.map((question, index) => {
                    return (
                      <SortableQuestionItem
                        key={question.id}
                        question={question}
                        index={index}
                        onDelete={handleDeleteQuestion}
                      />
                    );
                  })}
                </div>
              )}

              {/* Cards de Subcategorias com Perguntas - com Drag and Drop */}
              <div className="space-y-3">
                {subcatsWithQuestions.map((subcategory) => {
                  const subcatQuestions = questionsBySubcategory.get(subcategory.id) || [];
                  const isSubcatExpanded = expandedSubcategories.has(subcategory.id);
                  
                  return (
                    <SortableSubcategoryItem
                      key={subcategory.id}
                      subcategory={subcategory}
                      subcatQuestions={subcatQuestions}
                      categoryId={category.id}
                      isAddingQuestion={isAddingQuestion}
                      isExpanded={isSubcatExpanded}
                    />
                  );
                })}
              </div>
              
              {/* Subcategorias sem perguntas - mostrar como opção para adicionar */}
              {subcategories.filter(sub => !subcatsWithQuestions.find(s => s.id === sub.id)).map((subcategory) => (
                <div key={subcategory.id} className="border border-blue-200 dark:border-blue-700 border-dashed rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3">
                    <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <span className="text-blue-500 dark:text-blue-400">•</span>
                      {subcategory.value}
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-normal">
                        (sem perguntas)
                      </span>
                    </h4>
                  </div>
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10">
                    {!isAddingQuestion && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddQuestion(category.id, subcategory.id);
                        }}
                        className="w-full px-3 py-2 text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2 border border-dashed border-blue-300 dark:border-blue-700"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Primeira Pergunta
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Formulário de Nova Pergunta */}
              {isAddingQuestion && (
                <NewQuestionForm
                  categoryId={category.id}
                  selectedSubcategoryForModal={selectedSubcategoryForModal}
                  questionForm={questionForm}
                  replyTypes={replyTypes}
                  categories={categories}
                  onSave={async (question, description, replyTypeId, weight, required) => {
                    await handleSaveNewQuestion(category.id, question, description, replyTypeId, weight, required);
                  }}
                  onCancel={handleCancelNewQuestion}
                />
              )}

              {!isAddingQuestion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddQuestion(category.id, null);
                  }}
                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-medium bg-gray-50 dark:bg-gray-900/20 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Pergunta
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Componente para item de pergunta arrastável - MEMOIZADO com comparação customizada
  const SortableQuestionItem = React.memo(({ question, index, onDelete }: { question: QuestionData; index: number; onDelete: (id: number) => void }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: question.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
    };

    const isEditing = editingQuestionId === question.id;
    
    // Estado LOCAL para edição (não causa re-render do componente pai!)
    // IMPORTANTE: Declarar ANTES de usar nas variáveis abaixo
    const [localQuestion, setLocalQuestion] = React.useState(editQuestionForm.question);
    const [localDescription, setLocalDescription] = React.useState(editQuestionForm.description);
    const [localReplyTypeId, setLocalReplyTypeId] = React.useState(editQuestionForm.reply_type_id);
    const [localWeight, setLocalWeight] = React.useState(editQuestionForm.weight);
    const [localRequired, setLocalRequired] = React.useState(editQuestionForm.required);
    
    const selectedReplyType = replyTypes.find(t => t.id === (isEditing ? localReplyTypeId : question.reply_type_id));
    const isTextType = selectedReplyType?.value?.toLowerCase() === 'texto';

    // Atualizar estado local quando editQuestionForm mudar (apenas quando começar a editar)
    React.useEffect(() => {
      if (isEditing) {
        setLocalQuestion(editQuestionForm.question);
        setLocalDescription(editQuestionForm.description);
        setLocalReplyTypeId(editQuestionForm.reply_type_id);
        setLocalWeight(editQuestionForm.weight);
        setLocalRequired(editQuestionForm.required);
      }
    }, [isEditing, editQuestionForm.question, editQuestionForm.description, editQuestionForm.reply_type_id, editQuestionForm.weight, editQuestionForm.required]);

    // ❌ REMOVIDO: Não sincronizar no blur - causa re-render desnecessário
    // A sincronização acontece apenas no SAVE

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          isDragging ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-lg' : ''
        } ${isEditing ? 'ring-2 ring-blue-400' : ''}`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
          disabled={isEditing}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">
          {isEditing ? (
            // Modo de Edição
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
                  {index + 1}.
                </span>
                <div className="flex-1 space-y-3">
                  {/* Campo Pergunta */}
                  <input
                    key={`edit-question-${question.id}-${editingQuestionId}`}
                    id={`edit-question-input-${question.id}`}
                    name={`edit_question_${question.id}`}
                    type="text"
                    value={localQuestion}
                    onChange={(e) => setLocalQuestion(e.target.value)}
                    placeholder="Pergunta"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                  
                  {/* Campo Descrição */}
                  <textarea
                    key={`edit-description-${question.id}-${editingQuestionId}`}
                    id={`edit-description-input-${question.id}`}
                    name={`edit_description_${question.id}`}
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    placeholder="Descrição (opcional)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 resize-none"
                  />
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Tipo de Resposta */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tipo de Resposta
                      </label>
                      <select
                        value={localReplyTypeId || ''}
                        onChange={(e) => {
                          const newReplyTypeId = Number(e.target.value);
                          const newReplyType = replyTypes.find(t => t.id === newReplyTypeId);
                          const isText = newReplyType?.value?.toLowerCase() === 'texto';
                          setLocalReplyTypeId(newReplyTypeId);
                          setLocalWeight(isText ? 0 : localWeight);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">Selecione...</option>
                        {replyTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Peso */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Peso
                      </label>
                      <input
                        type="number"
                        value={localWeight}
                        onChange={(e) => setLocalWeight(Number(e.target.value))}
                        disabled={isTextType}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                      />
                    </div>
                    
                    {/* Obrigatória */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Obrigatória
                      </label>
                      <div className="flex items-center h-[38px]">
                        <input
                          type="checkbox"
                          checked={localRequired}
                          onChange={(e) => setLocalRequired(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Botões Save/Cancel */}
                  <div className="flex gap-2">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault(); // Previne blur
                        // Passar valores locais diretamente para a função de salvar
                        void handleSaveEditQuestion(
                          localQuestion, 
                          localDescription, 
                          localReplyTypeId, 
                          localWeight, 
                          localRequired
                        );
                      }}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelEditQuestion}
                      className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Modo de Visualização
            <>
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {question.question}
                  </p>
                  {question.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      {question.description}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Tags de informações da pergunta */}
              <div className="flex flex-wrap gap-2 mt-2 ml-5">
                {/* Subcategoria */}
                {/* {question.subcategory && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                    <span className="font-medium">Subcategoria:</span>
                    <span className="ml-1">{question.subcategory}</span>
                  </span>
                )} */}
                
                {/* Tipo de Resposta */}
                {(() => {
                  const replyType = replyTypes.find(t => t.id === question.reply_type_id);
                  return replyType ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded">
                      <span className="font-medium">Tipo:</span>
                      <span className="ml-1">{replyType.value}</span>
                    </span>
                  ) : null;
                })()}
                
                {/* Peso */}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${
                  question.weight === 0 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                }`}>
                  <span className="font-medium">Peso:</span>
                  <span className="ml-1">{question.weight}</span>
                </span>
                
                {/* Obrigatória */}
                {question.required && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded font-medium">
                    Obrigatória
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-1">
            <button
              onClick={() => handleEditQuestion(question)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Editar pergunta"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(question.id)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar pergunta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Avaliação não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Botão Voltar */}
      <button
        onClick={() => navigate('/evaluations')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Voltar para Avaliações</span>
      </button>

      {/* Card de Informações da Avaliação */}
      <div className="card p-6 pt-2 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {evaluation.name}
              </h1>
              {evaluation.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {evaluation.description}
                </p>
              )}
             
            </div>
          </div>

          {/* Status com Toggle Switch */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              evaluation.is_active 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {evaluation.is_active ? 'Ativo' : 'Inativo'}
            </span>
            
            {/* Toggle Switch */}
            <button
              onClick={async () => {
                if (!evaluation.is_active || confirm('Tem certeza que deseja desativar esta avaliação?')) {
                  const response = await apiClient.patch(`/api/evaluations/${id}/toggle-status`);
                  
                  if (!response.success) {
                    console.error('Erro ao alterar status da avaliação:', response.error);
                    alert('Erro ao alterar status da avaliação.');
                  } else {
                    await fetchEvaluation();
                  }
                }
              }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                evaluation.is_active 
                  ? 'bg-green-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={evaluation.is_active}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  evaluation.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Card de Categorias e Perguntas */}
      <div className="card p-6 flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Categorias e Perguntas
          </h2>
          <button
            onClick={async () => {
              await fetchAvailableCategories();
              setShowCategoryModal(true);
            }}
            className="px-4 py-2 text-sm text-white font-medium bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Categoria
          </button>
        </div>

        {questions.length === 0 && !newQuestionCategoryId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-base">
              Não há perguntas cadastradas para essa Avaliação.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Clique em "Adicionar Categoria" para começar.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={(event) => {
              const id = event.active.id as number;
              setActiveId(id);
              
              // Detectar o tipo do item
              if (mainCategories.some(cat => cat.id === id)) {
                setActiveType('category');
              } else if (categories.some(cat => cat.parent_id !== null && cat.id === id)) {
                setActiveType('subcategory');
              } else if (questions.some(q => q.id === id)) {
                setActiveType('question');
              }
            }}
            onDragEnd={async (event) => {
              await handleUnifiedDragEnd(event);
              setActiveId(null);
              setActiveType(null);
            }}
            onDragCancel={() => {
              setActiveId(null);
              setActiveType(null);
            }}
          >
            <SortableContext
              items={[
                ...displayCategories.map(c => c.id),
                ...categories.filter(c => c.parent_id !== null).map(c => c.id), // subcategorias
                // NÃO incluir perguntas aqui - elas são renderizadas dentro das categorias/subcategorias
              ]}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {displayCategories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const subcategories = getSubcategories(category.id);
                const categoryQuestions = getQuestionsByCategory(category.id);
                const isAddingQuestion = newQuestionCategoryId === category.id;

                return (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    isExpanded={isExpanded}
                    categoryQuestions={categoryQuestions}
                    subcategories={subcategories}
                    isAddingQuestion={isAddingQuestion}
                  />
                );
              })}
            </div>
          </SortableContext>

          {/* Drag Overlay - mostra o item sendo arrastado */}
          <DragOverlay>
            {activeId && activeType === 'question' ? (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-blue-500 opacity-90">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400 mt-0.5" />
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                    {questions.find(q => q.id === activeId)?.question || 'Pergunta'}
                  </p>
                </div>
              </div>
            ) : activeId && activeType === 'subcategory' ? (
              <div className="border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 shadow-2xl opacity-90">
                <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <GripVertical className="w-4 h-4" />
                  {categories.find(c => c.id === activeId)?.value || 'Subcategoria'}
                </h4>
              </div>
            ) : activeId && activeType === 'category' ? (
              <div className="border-2 border-orange-500 rounded-lg bg-orange-50 dark:bg-orange-900/20 p-4 shadow-2xl opacity-90">
                <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                  <GripVertical className="w-5 h-5" />
                  {mainCategories.find(c => c.id === activeId)?.value || 'Categoria'}
                </h3>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        )}

        {/* Modal de Adicionar Categoria */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <h2 className="text-xl font-bold">
                  Adicionar Categoria
                </h2>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setSelectedCategoryForModal(null);
                    setSelectedSubcategoryForModal(null);
                    setSubcategoriesForModal([]);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {availableCategories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Todas as categorias disponíveis já estão sendo usadas nesta avaliação.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Categoria Select */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Categoria: *
                      </label>
                      <select
                        value={selectedCategoryForModal || ''}
                        onChange={async (e) => {
                          const categoryId = e.target.value ? parseInt(e.target.value) : null;
                          if (categoryId) {
                            await handleCategorySelection(categoryId);
                          } else {
                            setSelectedCategoryForModal(null);
                            setSubcategoriesForModal([]);
                            setSelectedSubcategoryForModal(null);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">Selecione uma categoria...</option>
                        {availableCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategoria Select - só aparece se categoria estiver selecionada */}
                    {selectedCategoryForModal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Subcategoria: <span className="text-gray-400 text-xs">(opcional)</span>
                        </label>
                        {subcategoriesForModal.length === 0 ? (
                          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                            Sem subcategorias disponíveis para esta categoria
                          </div>
                        ) : (
                          <select
                            value={selectedSubcategoryForModal || ''}
                            onChange={(e) => {
                              const subcategoryId = e.target.value ? parseInt(e.target.value) : null;
                              setSelectedSubcategoryForModal(subcategoryId);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                          >
                            <option value="">Sem subcategoria</option>
                            {subcategoriesForModal.map((subcategory) => (
                              <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.value}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-6">
                  <button
                    onClick={() => {
                      setShowCategoryModal(false);
                      setSelectedCategoryForModal(null);
                      setSelectedSubcategoryForModal(null);
                      setSubcategoriesForModal([]);
                    }}
                    className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  {selectedCategoryForModal && (
                    <button
                      onClick={() => handleAddCategory(selectedCategoryForModal, selectedSubcategoryForModal)}
                      className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                  Confirmar Exclusão
                </h3>
                <button
                  onClick={cancelDeleteQuestion}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Tem certeza que deseja deletar esta pergunta? Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDeleteQuestion}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-medium bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteQuestion}
                  className="px-4 py-2 text-sm text-white font-medium bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Deletar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationDetail;
