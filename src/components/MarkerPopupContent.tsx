import { FiEdit2 } from 'react-icons/fi';
import { formatDistance } from '../utils/distance';

interface MarkerPopupContentProps {
  title: string;
  lat: number;
  lng: number;
  badgeText?: string;
  badgeColor?: string;
  description?: string;
  distanceKm?: number;
  onEdit?: () => void;
}

export default function MarkerPopupContent({
  title,
  lat,
  lng,
  badgeText,
  badgeColor,
  description,
  distanceKm,
  onEdit,
}: MarkerPopupContentProps) {
  return (
    <div className="spot-popup">
      <div className="spot-popup-header">
        <h3>{title}</h3>
        {onEdit && (
          <button className="spot-edit-btn" onClick={onEdit} aria-label="Edit marker">
            <FiEdit2 size={14} />
          </button>
        )}
      </div>
      {badgeText && badgeColor && (
        <span className="spot-category" style={{ background: badgeColor }}>
          {badgeText}
        </span>
      )}
      {description && <p>{description}</p>}
      {distanceKm !== undefined && (
        <p className="spot-distance">📍 {formatDistance(distanceKm)} away</p>
      )}
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Google Maps
      </a>
    </div>
  );
}
