import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  term: React.ReactNode;
  explanation: string;
}

export function InfoTooltip({ term, explanation }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY - 8, // 8px gap above element
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    if (visible) {
      updatePosition();
      // Reposition on scroll/resize so the tooltip stays locked to the element
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className="group inline-flex items-center gap-1 cursor-help w-fit"
    >
      <span className="border-b border-dashed border-iron/50 hover:border-bone transition-colors">
        {term}
      </span>
      <Info className="h-[14px] w-[14px] text-ash group-hover:text-bone transition-colors shrink-0" />

      {visible && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 1000001,
          }}
          className="animate-in fade-in duration-200"
        >
          <div className="relative rounded-md bg-void border border-iron px-3 py-2 text-xs font-medium text-bone shadow-xl min-w-[200px] max-w-[280px] text-center whitespace-normal break-words font-sans">
            {explanation}
            
            {/* Triangle pointer */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-iron"></div>
            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-void"></div>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
