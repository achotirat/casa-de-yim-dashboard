import type { ReactNode, CSSProperties } from 'react';

interface SectionHeadProps {
  title: string;
  italic?: string;
  meta?: string;
  right?: ReactNode;
}

export function SectionHead({ title, italic, meta, right }: SectionHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, gap: 18 }}>
      <div>
        <h3 className="cdy-section-h3" style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600, fontSize: 22, lineHeight: 1.1,
          color: 'var(--ink)', letterSpacing: '-.2px', margin: 0,
        }}>
          {title}
          {italic && <i style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>{italic}</i>}
        </h3>
        {meta && (
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 11.5, color: 'var(--muted)', fontWeight: 500, display: 'block', marginTop: 2,
          }}>{meta}</span>
        )}
      </div>
      {right}
    </div>
  );
}

interface SectionCardProps {
  alt?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export default function SectionCard({ alt, children, style }: SectionCardProps) {
  return (
    <div style={{
      background: alt ? 'var(--card-2)' : 'var(--card)',
      borderRadius: 22,
      padding: '22px 24px',
      border: alt ? 'none' : '1px solid var(--line)',
      boxShadow: '0 10px 24px -18px rgba(11,42,38,.28)',
      ...style,
    }}>
      {children}
    </div>
  );
}
