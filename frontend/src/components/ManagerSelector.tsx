import { useState, useEffect, useRef } from 'react';
import { Users, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DbUser } from '../types';

interface ManagerSelectorProps {
  projectId: number;
  currentOwners?: string[];
  onOwnerChange: (newOwner: DbUser | null) => void;
  onError?: (message: string) => void;
}

const ManagerSelector = ({ projectId, currentOwners, onOwnerChange, onError }: ManagerSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [managers, setManagers] = useState<DbUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchManagers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('position', '%Gestor%')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar gestores:', error);
        setManagers([]);
      } else {
        setManagers(data || []);
      }
      setIsLoading(false);
    };

    if (isOpen) {
      fetchManagers();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManagerSelect = async (manager: DbUser) => {
    try {
      // Verificar se este gestor já é responsável pelo projeto
      const isAlreadyOwner = currentOwners?.includes(manager.user_id || '');
      
      if (isAlreadyOwner) {
        onError?.('Este gestor já é responsável pelo projeto');
        return;
      }

      // Sempre criar um novo registro (permitindo múltiplos gestores)
      const { error: insertError } = await supabase
        .from('projects_owner')
        .insert({
          project_id: projectId,
          user_id: manager.user_id
        });

      if (insertError) {
        console.error('Erro ao adicionar responsável:', insertError);
        onError?.('Erro ao adicionar responsável do projeto');
        return;
      }

      // Notificar o componente pai sobre a mudança
      onOwnerChange(manager);
      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar responsável:', error);
      onError?.('Erro inesperado ao adicionar responsável');
    }
  };

  const filteredManagers = managers.filter(manager =>
    manager.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ml-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
        title="Adiciona responsável"
      >
        <Users className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
          {/* <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <input
              type="text"
              placeholder="Buscar gestor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div> */}
          
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-center text-gray-500">
                Carregando gestores...
              </div>
            ) : filteredManagers.length > 0 ? (
              filteredManagers.map((manager) => (
                <button
                  key={manager.user_id}
                  onClick={() => handleManagerSelect(manager)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <img
                    className="w-6 h-6 rounded-full object-cover"
                    src={manager.avatar_large_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.name)}&background=random`}
                    alt={manager.name}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {manager.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {manager.position}
                    </p>
                  </div>
                  {currentOwners?.includes(manager.user_id || '') && (
                    <Check className="w-4 h-4 text-orange-500" />
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-gray-500">
                Nenhum gestor encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerSelector;
