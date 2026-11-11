import { useEffect, useState } from 'react';
import { Delete, LockKeyhole } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export default function LockScreen() {
  const { state, setLocked } = useStore();
  const pin = String(state.settings.pin || '');
  const [val, setVal] = useState('');
  const [shake, setShake] = useState(false);

  const press = (d) => setVal((v) => (v.length < pin.length ? v + d : v));
  const back = () => setVal((v) => v.slice(0, -1));

  useEffect(() => {
    if (val.length !== pin.length || !pin) return;
    if (val === pin) {
      setLocked(false);
    } else {
      setShake(true);
      const t = setTimeout(() => { setShake(false); setVal(''); }, 450);
      return () => clearTimeout(t);
    }
  }, [val, pin, setLocked]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="lock">
      <div className="lock-card">
        <img src="logo.svg" alt="" className="lock-logo" />
        <h2>{state.settings.cafeName}</h2>
        <p className="lock-sub"><LockKeyhole size={14} /> Enter PIN to unlock</p>
        <div className={`pin-dots ${shake ? 'shake' : ''}`}>
          {Array.from({ length: pin.length }, (_, i) => <span key={i} className={i < val.length ? 'on' : ''} />)}
        </div>
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)}>{d}</button>
          ))}
          <span />
          <button onClick={() => press('0')}>0</button>
          <button onClick={back} aria-label="Delete"><Delete size={20} /></button>
        </div>
        <p className="lock-hint">Default PIN is 1234. You can change it in Settings.</p>
      </div>
    </div>
  );
}
