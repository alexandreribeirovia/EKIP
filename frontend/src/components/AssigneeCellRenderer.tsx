import { useEffect, useRef } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import { DbTask, AssigneeUser } from '../types';
import tippy, { Instance as TippyInstance } from 'tippy.js';

const AssigneeCellRenderer = (params: ICellRendererParams<DbTask>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tippyInstances = useRef<TippyInstance[]>([]);

  const assignees: AssigneeUser[] = params.data?.assignments
    ?.map(a => a.users)
    .filter((user): user is AssigneeUser => user !== null) || [];

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      tippyInstances.current.forEach(instance => instance.destroy());
      tippyInstances.current = [];

      const avatarElements = container.querySelectorAll('.assignee-avatar');
      avatarElements.forEach((el, index) => {
        const assignee = assignees[index];
        if (assignee) {
          const instance = tippy(el, {
            content: assignee.name,
            placement: 'top',
            arrow: true,
          });
          tippyInstances.current.push(instance);
        }
      });

      const moreElement = container.querySelector('.assignee-more');
      if (moreElement) {
        const hiddenAssignees = assignees.slice(5);
        const content = hiddenAssignees.map(a => a.name).join('<br>');
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
  }, [assignees]);

  if (!assignees || assignees.length === 0) {
    return <span>-</span>;
  }
  
  const displayLimit = 5;
  const visibleAssignees = assignees.slice(0, displayLimit);
  const hiddenCount = assignees.length - visibleAssignees.length;

  return (
    <div ref={containerRef} className="flex items-center h-full">
      {visibleAssignees.map((assignee, index) => (
        <img
          key={assignee.user_id}
          className={`assignee-avatar w-7 h-7 rounded-full object-cover border-2 border-white dark:border-gray-700 ${index > 0 ? '-ml-2' : ''}`}
          src={assignee.avatar_large_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.name)}&background=random`}
          alt={assignee.name}
        />
      ))}
      {hiddenCount > 0 && (
        <div className="assignee-more w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-semibold flex items-center justify-center border-2 border-white dark:border-gray-700 -ml-2">
          +{hiddenCount}
        </div>
      )}
    </div>
  );
};

export default AssigneeCellRenderer;