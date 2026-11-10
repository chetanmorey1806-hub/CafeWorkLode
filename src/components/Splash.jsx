import { useEffect, useState } from 'react';

/** 3-second animated logo splash shown before the app starts */
export default function Splash({ onDone, duration = 3000 }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), duration - 500);
    const t2 = setTimeout(onDone, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone, duration]);

  return (
    <div className={`splash ${leaving ? 'splash-out' : ''}`}>
      <div className="splash-glow" />
      <div className="splash-logo-wrap">
        <span className="splash-ring" />
        <img src="logo.svg" alt="Soffity Cafe" className="splash-logo" />
        <div className="splash-steam">
          <span /><span /><span />
        </div>
      </div>
      <h1 className="splash-title">
        {'Soffity Cafe'.split('').map((c, i) => (
          <span key={i} style={{ animationDelay: `${0.9 + i * 0.06}s` }}>{c === ' ' ? ' ' : c}</span>
        ))}
      </h1>
      <p className="splash-tag">Brewing happiness, one cup at a time</p>
      <div className="splash-bar"><div /></div>
    </div>
  );
}
