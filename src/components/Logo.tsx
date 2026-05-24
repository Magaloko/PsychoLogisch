import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 38 : 32;
  const textClass =
    size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl';

  return (
    <div className="flex items-center gap-3">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 36 36"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {/* Background tile */}
        <rect width="36" height="36" rx="9" fill="#eef2ff" />
        {/* Left hemisphere */}
        <path
          d="M18,7 C13,7 9,9.5 8,13 C7,16 8,19 10,21 C9,23 9,26 11,27.5 C13,29 16,28.5 17.5,27.5 L18,7Z"
          fill="#4f46e5"
        />
        {/* Right hemisphere */}
        <path
          d="M18,7 C23,7 27,9.5 28,13 C29,16 28,19 26,21 C27,23 27,26 25,27.5 C23,29 20,28.5 18.5,27.5 L18,7Z"
          fill="#0d9488"
        />
        {/* Center divider */}
        <line
          x1="18" y1="7.5" x2="18" y2="27.5"
          stroke="white" strokeWidth="1.5" strokeLinecap="round"
        />
        {/* Brainstem */}
        <rect x="15" y="26.5" width="6" height="5" rx="3" fill="url(#brainGrad)" />
        {/* Left gyrus fold */}
        <path
          d="M12,14 Q14.5,17 12,20"
          stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.75"
        />
        {/* Right gyrus fold */}
        <path
          d="M24,14 Q21.5,17 24,20"
          stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.75"
        />
      </svg>

      <span className={`${textClass} font-bold leading-none tracking-tight`}>
        <span className="text-teal-600">Psycho</span>
        <span className="text-slate-900">Logisch</span>
      </span>
    </div>
  );
}
