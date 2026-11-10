import { useEffect } from 'react';
import { ORDER_STATUS } from '../utils/helpers';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
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

export const StatCard = ({ icon, label, value, sub, tone = 'brown' }) => (
  <div className={`stat-card tone-${tone}`}>
    <div className="stat-icon">{icon}</div>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

export const StatusBadge = ({ status }) => {
  const s = ORDER_STATUS[status] || { label: status, color: 'muted' };
  return <span className={`badge badge-${s.color}`}>{s.label}</span>;
};

export const Empty = ({ icon = '📭', text }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <p>{text}</p>
  </div>
);

export const PageHead = ({ title, subtitle, children }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
    {children && <div className="page-actions">{children}</div>}
  </div>
);

export const VegDot = ({ veg }) => <span className={`veg-dot ${veg ? 'veg' : 'nonveg'}`} title={veg ? 'Veg' : 'Non-veg'} />;
