import { forwardRef, useEffect, useImperativeHandle, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ICellEditorParams } from 'ag-grid-community';
import { supabase } from '../lib/supabaseClient';
import { DbUser } from '../types';

interface RiskOwnerCellEditorProps extends ICellEditorParams {
  value: any;
}

export interface RiskOwnerCellEditorRef {
  getValue: () => any;
}

const RiskOwnerCellEditor = forwardRef<RiskOwnerCellEditorRef, RiskOwnerCellEditorProps>((props, ref) => {
  // Extrair o valor corretamente - pode ser string ou objeto
  const initialValue = typeof props.value === 'object' && props.value !== null 
    ? (props.value.display || '') 
    : (props.value || '');
  const initialUserId = typeof props.value === 'object' && props.value !== null 
    ? (props.value.userId || null) 
    : null;

  const [inputValue, setInputValue] = useState<string>(initialValue);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<DbUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hasLoadedUsers, setHasLoadedUsers] = useState(false);

  // Buscar usuários ativos SOMENTE quando o input for focado
  const fetchActiveUsers = async () => {
    if (hasLoadedUsers) return; // Já carregou, não carregar novamente
    
    console.log('Buscando usuários ativos...');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Erro ao buscar usuários:', error);
    } else if (data) {
      console.log('Usuários carregados:', data.length);
      setUsers(data);
      setHasLoadedUsers(true);
      // Se não há inputValue, mostrar todos os usuários
      if (!inputValue.trim()) {
        setFilteredUsers(data);
      }
    }
  };

  // Filtrar usuários conforme digita (somente se já carregou)
  useEffect(() => {
    if (!hasLoadedUsers || users.length === 0) return;
    
    if (inputValue.trim()) {
      const filtered = users.filter(user =>
        user.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      console.log('Usuários filtrados:', filtered.length, 'de', users.length);
      setFilteredUsers(filtered);
      setSelectedIndex(-1);
    } else {
      // Se não tem texto, mostrar todos os usuários
      console.log('Mostrando todos os usuários:', users.length);
      setFilteredUsers(users);
      setSelectedIndex(-1);
    }
  }, [inputValue, users, hasLoadedUsers]);

  // Atualizar posição do dropdown
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(rect.width, 250)
      });
    }
  }, []);

  // Focar no input ao montar (mas NÃO carregar usuários automaticamente)
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // Calcular posição do dropdown
    updateDropdownPosition();
  }, [updateDropdownPosition]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  // Retorna o valor ao grid
  useImperativeHandle(ref, () => ({
    getValue: () => {
      const returnValue = selectedUserId
        ? {
            userId: selectedUserId,
            display: users.find(u => u.user_id === selectedUserId)?.name || inputValue,
            isUser: true
          }
        : {
            userId: null,
            display: inputValue,
            isUser: false
          };
      
      console.log('RiskOwnerCellEditor getValue retornando:', returnValue);
      return returnValue;
    }
  }));

  const handleUserSelect = (user: DbUser) => {
    console.log('Usuário selecionado:', user.name, 'ID:', user.user_id);
    setInputValue(user.name);
    setSelectedUserId(user.user_id || null);
    setShowDropdown(false);
    setFilteredUsers([]);
    // NÃO chamar props.stopEditing() aqui - deixar o usuário decidir quando sair da célula
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredUsers[selectedIndex]) {
        handleUserSelect(filteredUsers[selectedIndex]);
      } else {
        // Se não selecionou ninguém, apenas usar o texto livre
        setSelectedUserId(null);
        setShowDropdown(false);
      }
      // NÃO chamar stopEditing() - deixar o grid em modo de edição (editType="fullRow")
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
      props.stopEditing(true); // true = cancel
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredUsers[selectedIndex]) {
        handleUserSelect(filteredUsers[selectedIndex]);
      }
      // NÃO chamar stopEditing() - deixar o grid em modo de edição (editType="fullRow")
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // Limpar seleção de usuário quando começar a digitar novamente
    if (selectedUserId) {
      setSelectedUserId(null);
    }
  };

  const renderDropdown = () => {
    if (!showDropdown || filteredUsers.length === 0) return null;

    return (
      <div 
        ref={dropdownRef}
        className="bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
        style={{
          position: 'fixed',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          zIndex: 99999,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
      >
        {filteredUsers.map((user, index) => (
          <div
            key={user.user_id}
            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
              index === selectedIndex ? 'bg-gray-100' : ''
            }`}
            onClick={() => handleUserSelect(user)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center gap-2">
              {user.avatar_large_url && (
                <img 
                  src={user.avatar_large_url} 
                  alt={user.name}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="text-sm text-gray-900">{user.name}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="relative w-full h-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            console.log('Input focado, carregando usuários...');
            // Carregar usuários somente quando o input for focado
            fetchActiveUsers();
            updateDropdownPosition();
            if (filteredUsers.length > 0) {
              setShowDropdown(true);
            }
          }}
          className="w-full h-full px-2 border-none outline-none bg-transparent"
          placeholder="Digite ou selecione um usuário..."
        />
      </div>
      
      {/* Renderizar dropdown usando Portal para garantir que apareça acima do grid */}
      {createPortal(renderDropdown(), document.body)}
    </>
  );
});

RiskOwnerCellEditor.displayName = 'RiskOwnerCellEditor';

export default RiskOwnerCellEditor;

