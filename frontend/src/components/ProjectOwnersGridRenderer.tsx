import { useEffect, useRef } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import { DbProjectOwner } from '../types';
import tippy, { Instance as TippyInstance } from 'tippy.js';

interface ProjectOwnersGridRendererProps extends ICellRendererParams {
  value: DbProjectOwner[];
}

const ProjectOwnersGridRenderer = (params: ProjectOwnersGridRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tippyInstances = useRef<TippyInstance[]>([]);

  // Garantir que owners seja sempre um array válido
  const owners = Array.isArray(params.value) ? params.value : [];

  useEffect(() => {
    const container = containerRef.current;
    if (container && owners.length > 0) {
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

  if (!owners || owners.length === 0) {
    return <span className="text-gray-500">-</span>;
  }

  const displayLimit = 3;
  const visibleOwners = owners.slice(0, displayLimit);
  const hiddenCount = owners.length - visibleOwners.length;

  return (
    <div ref={containerRef} className="flex items-center h-full">
      {visibleOwners.map((owner, index) => (
        <img
          key={owner.id}
          className={`owner-avatar w-6 h-6 rounded-full object-cover border-2 border-white dark:border-gray-700 ${index > 0 ? '-ml-1' : ''}`}
          src={owner.users?.avatar_large_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.users?.name || '')}&background=random`}
          alt={owner.users?.name || ''}
        />
      ))}
      {hiddenCount > 0 && (
        <div className="owners-more w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-semibold flex items-center justify-center border-2 border-white dark:border-gray-700 -ml-1">
          +{hiddenCount}
        </div>
      )}
    </div>
  );
};

export default ProjectOwnersGridRenderer;
