import React from 'react';

interface ScreenStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty, gated or failed-to-load state. No box or border: the text sits vertically
 * centred in the available screen, so it reads as a page state, not a card.
 */
export const ScreenState: React.FC<ScreenStateProps> = ({ title, body, actionLabel, onAction }) => (
  <div className="min-h-[65vh] flex flex-col items-center justify-center text-center px-6 gap-3">
    <p className="font-display text-xl font-semibold text-[#0F172A]">{title}</p>
    {body && <p className="text-sm text-[#64748B] max-w-sm leading-relaxed">{body}</p>}
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#6C2BD9]">
        {actionLabel}
      </button>
    )}
  </div>
);
