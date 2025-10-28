import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface HtmlCellRendererProps {
  value: string;
}

const HtmlCellRenderer = ({ value }: HtmlCellRendererProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseEnter = () => {
      if (cellRef.current) {
        const rect = cellRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const tooltipMaxWidth = 600; // largura máxima do tooltip
        
        // Calcular posição left para evitar sair da tela
        let leftPosition = rect.left + window.scrollX;
        if (leftPosition + tooltipMaxWidth > viewportWidth) {
          leftPosition = viewportWidth - tooltipMaxWidth - 20;
        }
        
        setTooltipPosition({
          top: rect.bottom + window.scrollY + 5,
          left: Math.max(10, leftPosition)
        });
        setShowTooltip(true);
      }
    };

    const handleMouseLeave = () => {
      setShowTooltip(false);
    };

    const cellElement = cellRef.current;
    if (cellElement) {
      cellElement.addEventListener('mouseenter', handleMouseEnter);
      cellElement.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        cellElement.removeEventListener('mouseenter', handleMouseEnter);
        cellElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);

  // Remove tags HTML para exibir apenas o texto na célula
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (!value) return <span className="text-gray-400">-</span>;

  const textOnly = stripHtml(value);

  const tooltipContent = showTooltip && (
    <div
      className="fixed z-[10000] bg-white dark:bg-gray-800 border border-orange-500 dark:border-orange-400 rounded-lg shadow-2xl p-4 max-w-[600px] max-h-96 overflow-y-auto"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100"
        dangerouslySetInnerHTML={{ __html: value }}
        style={{
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      />
    </div>
  );

  return (
    <>
      <div
        ref={cellRef}
        className="truncate cursor-help text-gray-900 dark:text-gray-100 h-full flex items-center"
        // title="Passe o mouse para ver o conteúdo completo"
      >
        {textOnly}
      </div>

      {/* Renderizar tooltip via portal para evitar problemas de overflow */}
      {createPortal(tooltipContent, document.body)}
    </>
  );
};

export default HtmlCellRenderer;
