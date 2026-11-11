import { useEffect, useRef, useState } from 'react';
import { X, Inbox, TrendingUp, TrendingDown } from 'lucide-react';
import { ORDER_STATUS } from '../utils/helpers';

export function Modal({ title, icon: Icon, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="flex-c">{Icon && <span className="modal-icon"><Icon size={18} /></span>}{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

/** Animates a number from 0 to `value` */
export function useCountUp(value, duration = 900) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = a + (value - a) * eased;
      from.current = cur;
      setN(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

export const CountUp = ({ value, format = (v) => Math.round(v) }) => <>{format(useCountUp(value))}</>;

/**
 * value: number (animated) or string. format: formatter for numbers.
 * trend: optional % change (number) shown as up/down chip.
 */
export const StatCard = ({ icon: Icon, label, value, format, sub, tone = 'brown', trend }) => (
  <div className={`stat-card tone-${tone}`}>
    <div className="stat-icon">{Icon && <Icon size={22} strokeWidth={2} />}</div>
    <div className="stat-body">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
      </div>
      {(sub || trend !== undefined) && (
        <div className="stat-sub">
          {trend !== undefined && isFinite(trend) && (
            <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
    <div className="stat-deco"><Icon size={78} strokeWidth={1.2} /></div>
  </div>
);

export const StatusBadge = ({ status }) => {
  const s = ORDER_STATUS[status] || { label: status, color: 'muted' };
  return <span className={`badge badge-${s.color} badge-dot`}>{s.label}</span>;
};

export const Empty = ({ icon: Icon = Inbox, text }) => (
  <div className="empty">
    <div className="empty-icon"><Icon size={30} strokeWidth={1.6} /></div>
    <p>{text}</p>
  </div>
);

export const PageHead = ({ title, subtitle, icon: Icon, children }) => (
  <div className="page-head">
    <div className="ph-left">
      {Icon && <div className="ph-icon"><Icon size={22} /></div>}
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="page-actions">{children}</div>}
  </div>
);

export const SearchInput = ({ icon: Icon, className = '', inputRef, ...props }) => (
  <div className={`input-icon ${className}`}>
    {Icon && <Icon size={16} />}
    <input ref={inputRef} {...props} />
  </div>
);

export const VegDot = ({ veg }) => <span className={`veg-dot ${veg ? 'veg' : 'nonveg'}`} title={veg ? 'Veg' : 'Non-veg'} />;
