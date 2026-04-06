import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  node: ReactNode;
}

interface Props {
  items: MenuItem[];
  className?: string;
}

const GAP = 6; // must match CSS gap value
const HAMBURGER_FALLBACK_WIDTH = 38; // used when hamburger ref isn't yet measured

export default function OverflowMenuBar({ items, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const [overflowStart, setOverflowStart] = useState<number>(items.length);
  // Track the itemIds snapshot at the time the dropdown was opened.
  // Comparing to the current itemIds lets the dropdown close automatically
  // when the item list changes (e.g. tool mode switches), without calling
  // setState inside an effect.
  const [dropdownAnchorIds, setDropdownAnchorIds] = useState<string | null>(null);

  const itemIds = useMemo(() => items.map((i) => i.id).join('\0'), [items]);
  const hasOverflow = overflowStart < items.length;
  const dropdownOpen = dropdownAnchorIds === itemIds && hasOverflow;

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const available = container.offsetWidth;
    const children = Array.from(measure.children) as HTMLElement[];
    if (children.length === 0) return;

    const widths = children.map((el) => el.offsetWidth);
    const totalNoHamburger = widths.reduce((s, w, i) => s + w + (i > 0 ? GAP : 0), 0);

    if (totalNoHamburger <= available) {
      setOverflowStart(children.length);
      return;
    }

    // Reserve space for the hamburger button
    const hb = hamburgerRef.current;
    const hbWidth = hb ? hb.offsetWidth + GAP : HAMBURGER_FALLBACK_WIDTH;
    const effective = available - hbWidth;

    let used = 0;
    let fitCount = 0;
    for (let i = 0; i < widths.length; i++) {
      const needed = widths[i] + (i > 0 ? GAP : 0);
      if (used + needed <= effective) {
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
  useEffect(() => {
    recalculate();
  }, [itemIds, recalculate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropdownAnchorIds(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const visibleItems = items.slice(0, overflowStart);
  const overflowItems = items.slice(overflowStart);

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

      {/* Hamburger – always in DOM so its width can be measured, visually hidden when unneeded */}
      <button
        ref={hamburgerRef}
        className={`overflow-hamburger${hasOverflow ? '' : ' overflow-hamburger--hidden'}`}
        onClick={() => setDropdownAnchorIds((prev) => (prev === itemIds ? null : itemIds))}
        aria-label="More actions"
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        tabIndex={hasOverflow ? 0 : -1}
      >
        ☰
        {hasOverflow && <span className="overflow-dot" aria-hidden="true" />}
      </button>

      {/* Overflow dropdown */}
      {hasOverflow && dropdownOpen && (
        <div className="overflow-dropdown" role="menu">
          {overflowItems.map((item) => (
            <div key={item.id} className="overflow-dropdown-item" role="menuitem">
              {item.node}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
