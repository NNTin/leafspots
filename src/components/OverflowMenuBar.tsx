import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  node: ReactNode;
}

interface Props {
  items: MenuItem[];
  onOverflowChange?: (overflowItems: MenuItem[]) => void;
  className?: string;
}

const GAP = 6; // must match CSS gap value

export default function OverflowMenuBar({ items, onOverflowChange, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const [overflowStart, setOverflowStart] = useState<number>(items.length);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const available = container.offsetWidth;
    const children = Array.from(measure.children) as HTMLElement[];
    if (children.length === 0) return;

    const widths = children.map((el) => el.offsetWidth);
    const totalWidth = widths.reduce((s, w, i) => s + w + (i > 0 ? GAP : 0), 0);

    if (totalWidth <= available) {
      setOverflowStart(children.length);
      return;
    }

    let used = 0;
    let fitCount = 0;
    for (let i = 0; i < widths.length; i++) {
      const needed = widths[i] + (i > 0 ? GAP : 0);
      if (used + needed <= available) {
        used += needed;
        fitCount++;
      } else {
        break;
      }
    }
    setOverflowStart(fitCount);
  }, []);

  // Register ResizeObserver once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(recalculate);
    ro.observe(container);
    recalculate();
    return () => ro.disconnect();
  }, [recalculate]);

  // Recalculate whenever the item list changes
  const itemIds = useMemo(() => items.map((i) => i.id).join('\0'), [items]);
  useEffect(() => {
    recalculate();
  }, [itemIds, recalculate]);

  // Report overflow items to parent whenever overflowStart or items change
  useEffect(() => {
    onOverflowChange?.(items.slice(overflowStart));
  }, [overflowStart, items, onOverflowChange]);

  const visibleItems = items.slice(0, overflowStart);

  const containerClass = ['overflow-menu-bar', className].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Hidden measurement row – absolutely positioned so it never affects layout */}
      <div ref={measureRef} className="overflow-measure-row" aria-hidden="true">
        {items.map((item) => (
          <div key={item.id}>{item.node}</div>
        ))}
      </div>

      {/* Visible toolbar items */}
      {visibleItems.map((item) => (
        <div key={item.id} className="overflow-menu-item">
          {item.node}
        </div>
      ))}
    </div>
  );
}
