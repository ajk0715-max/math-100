'use client';

/** 켜고 끄는 한 줄 단추 */
export function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" className="switch-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="grow">
        <span className="label">{label}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <span className={`switch${on ? ' on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
