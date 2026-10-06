import React from 'react';

/**
 * ItemCard — primitif item/kartu daftar "Soft 3D".
 *
 * Pola seragam di seluruh app (menyusul item sidebar dashboard):
 *   ┌─ bar aksen kiri (4px, --item-accent)
 *   │  [ikon dalam tile ber-tint aksen]
 *   │  Judul tebal  ·  baris meta kecil abu
 *   └  (opsional trailing: badge/tombol)
 *
 * `accent` mengatur warna bar + tile (mis. warna severity, sektor, kategori).
 */
export interface ItemCardProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Bar aksen lebih tegas saat aktif. Default: true. */
  active?: boolean;
  /** Warna aksen (hex/var). Default: var(--color-brand). */
  accent?: string;
  onClick?: () => void;
  className?: string;
  /** Isi tambahan di bawah baris meta. */
  children?: React.ReactNode;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  icon,
  title,
  meta,
  trailing,
  active = true,
  accent,
  onClick,
  className = '',
  children,
}) => {
  const Tag: any = onClick ? 'button' : 'div';
  const style = accent ? ({ ['--item-accent' as any]: accent } as React.CSSProperties) : undefined;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={style}
      className={`item-card ${onClick ? 'item-card-interactive' : ''} w-full text-left ${className}`}
    >
      <span className="item-bar" style={{ opacity: active ? 1 : 0.4 }} />
      {icon && <span className="item-tile">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-bold text-ink truncate leading-tight">{title}</span>
        {meta && <span className="block text-[11px] text-ink-3 mt-1 truncate">{meta}</span>}
        {children}
      </span>
      {trailing && <span className="shrink-0 self-center flex items-center gap-1.5">{trailing}</span>}
    </Tag>
  );
};
