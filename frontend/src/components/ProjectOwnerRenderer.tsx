import { useEffect, useRef } from 'react';
import { DbProjectOwner, DbUser } from '../types';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import ManagerSelector from './ManagerSelector';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ProjectOwnerRendererProps {
  owners?: DbProjectOwner[];
  projectId: number;
  onOwnerChange?: (newOwner: DbUser | null) => void;
  onOwnerRemove?: (removedOwnerId: number) => void;
  onError?: (message: string) => void;
  readOnly?: boolean;
}

const ProjectOwnerRenderer = ({ owners, projectId, onOwnerChange, onOwnerRemove, onError, readOnly = false }: ProjectOwnerRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tippyInstances = useRef<TippyInstance[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (container && owners && owners.length > 0) {
      // Limpar instâncias anteriores
      tippyInstances.current.forEach(instance => instance.destroy());
      tippyInstances.current = [];

      const avatarElements = container.querySelectorAll('.owner-avatar');
      avatarElements.forEach((el, index) => {
        const owner = owners[index];
        if (owner?.users) {
          const instance = tippy(el, {
            content: owner.users.name,
            placement: 'top',
            arrow: true,
          });
          tippyInstances.current.push(instance);
        }
      });

      const moreElement = container.querySelector('.owners-more');
      if (moreElement && owners.length > 3) {
        const hiddenOwners = owners.slice(3);
        const content = hiddenOwners.map(o => o.users?.name).filter(Boolean).join('<br>');
        const instance = tippy(moreElement, {
          content,
          allowHTML: true,
          placement: 'top',
          arrow: true,
        });
        tippyInstances.current.push(instance);
      }
    }

    return () => {
      tippyInstances.current.forEach(instance => instance.destroy());
    };
  }, [owners]);

  const handleRemoveOwner = async (owner: DbProjectOwner) => {
    try {
      const { error } = await supabase
        .from('projects_owner')
        .delete()
        .eq('id', owner.id);

      if (error) {
        console.error('Erro ao remover responsável:', error);
        onError?.('Erro ao remover responsável do projeto');
        return;
      }

      onOwnerRemove?.(owner.id);
    } catch (error) {
      console.error('Erro ao remover responsável:', error);
      onError?.('Erro inesperado ao remover responsável');
    }
  };

  const displayLimit = 3;
  const visibleOwners = owners?.slice(0, displayLimit) || [];
  const hiddenCount = (owners?.length || 0) - visibleOwners.length;
  const currentOwnerIds = owners?.map(o => o.user_id).filter(Boolean) || [];

  return (
    <div ref={containerRef} className="flex items-center">
      {visibleOwners.length > 0 ? (
        visibleOwners.map((owner, index) => (
          <div key={owner.id} className={`relative group ${index > 0 ? '-ml-2' : ''}`}>
            <img
              className="owner-avatar w-7 h-7 rounded-full object-cover border-2 border-white dark:border-gray-700"
              src={owner.users?.avatar_large_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.users?.name || '')}&background=random`}
              alt={owner.users?.name || ''}
            />
            {!readOnly && (
              <button
                onClick={() => handleRemoveOwner(owner)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover responsável"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
          <span className="text-xs text-gray-500">?</span>
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="owners-more w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-semibold flex items-center justify-center border-2 border-white dark:border-gray-700 -ml-2">
          +{hiddenCount}
        </div>
      )}
      {!readOnly && (
        <ManagerSelector
          projectId={projectId}
          currentOwners={currentOwnerIds}
          onOwnerChange={onOwnerChange || (() => {})}
          onError={onError}
        />
      )}
    </div>
  );
};

export default ProjectOwnerRenderer;
