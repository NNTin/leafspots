interface Props {
  drawMode: boolean;
  hasStrokes: boolean;
  onToggleDrawMode: () => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
  strokeColor: string;
  strokeWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  pinMode: boolean;
  hasPins: boolean;
  pinColor: string;
  onTogglePinMode: () => void;
  onClearPins: () => void;
  onPinColorChange: (color: string) => void;
}

const PRESET_COLORS = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#000000', '#ffffff'];
const PRESET_WIDTHS = [2, 4, 6];

export default function DrawingControls({
  drawMode,
  hasStrokes,
  onToggleDrawMode,
  onUndo,
  onClear,
  onExport,
  strokeColor,
  strokeWidth,
  onColorChange,
  onWidthChange,
  pinMode,
  hasPins,
  pinColor,
  onTogglePinMode,
  onClearPins,
  onPinColorChange,
}: Props) {
  return (
    <div className="drawing-controls">
      <button
        className={`draw-btn${drawMode ? ' active' : ''}`}
        onClick={onToggleDrawMode}
        title={drawMode ? 'Exit Draw Mode — pan map' : 'Enter Draw Mode — draw on map'}
      >
        {drawMode ? '✋ Pan' : '✏️ Draw'}
      </button>

      {drawMode && (
        <div className="draw-options">
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${strokeColor === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => onColorChange(c)}
                title={c}
                aria-label={`Stroke color ${c}`}
              />
            ))}
          </div>
          <div className="width-btns">
            {PRESET_WIDTHS.map((w) => (
              <button
                key={w}
                className={`width-btn${strokeWidth === w ? ' active' : ''}`}
                onClick={() => onWidthChange(w)}
                title={`Stroke width ${w}px`}
                aria-label={`Stroke width ${w}px`}
              >
                <span
                  style={{
                    display: 'block',
                    width: 18,
                    height: w,
                    background: 'currentColor',
                    borderRadius: 2,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {hasStrokes && (
        <>
          <button className="draw-action-btn" onClick={onUndo} title="Undo last stroke" aria-label="Undo last stroke">
            ↩
          </button>
          <button className="draw-action-btn" onClick={onClear} title="Clear all drawings" aria-label="Clear all drawings">
            🗑
          </button>
        </>
      )}

      <button
        className={`draw-btn${pinMode ? ' active' : ''}`}
        onClick={onTogglePinMode}
        title={pinMode ? 'Exit Pin Mode — click to stop placing pins' : 'Enter Pin Mode — click map to place pins'}
      >
        {pinMode ? '📍 Pinning…' : '📍 Pin'}
      </button>

      {pinMode && (
        <div className="draw-options">
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${pinColor === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => onPinColorChange(c)}
                title={c}
                aria-label={`Pin color ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      {hasPins && (
        <button className="draw-action-btn" onClick={onClearPins} title="Clear all pins" aria-label="Clear all pins">
          🗑
        </button>
      )}

      <button className="draw-action-btn" onClick={onExport} title="Copy shareable link to clipboard" aria-label="Share map">
        🔗
      </button>
    </div>
  );
}
