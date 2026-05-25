import React from 'react';
import { X } from 'lucide-react';

interface LegalModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function LegalModal({ title, onClose, children }: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
