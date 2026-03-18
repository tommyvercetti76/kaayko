/**
 * SVG ring (arc) component for the Cockpit dashboard.
 * @param {number} value - current value
 * @param {number} max - target/max value
 * @param {number} size - SVG size in px
 * @param {number} strokeWidth - ring thickness
 * @param {string} color - stroke color
 * @param {string} label - text below the number
 * @param {boolean} large - larger center number
 */
export default function Ring({ value = 0, max = 1, size = 80, strokeWidth = 8, color = '#34d399', label, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / max));
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={pct > 1 ? '#f87171' : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        {/* Center content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: 'none' }}
        >
          {children}
        </div>
      </div>
      {label && (
        <span className="text-xs" style={{ color: '#64748b' }}>
          {label}
        </span>
      )}
    </div>
  );
}
