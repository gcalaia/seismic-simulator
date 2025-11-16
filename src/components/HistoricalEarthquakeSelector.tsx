import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronRight, Info, Calendar, MapPin, Activity } from 'lucide-react';
import { HistoricalEarthquake, HISTORICAL_EARTHQUAKES } from './useHistoricalEarthquake';

interface HistoricalEarthquakeSelectorProps {
  onSelectEarthquake: (earthquake: HistoricalEarthquake) => void;
  selectedEarthquake: HistoricalEarthquake | null;
  isLoading: boolean;
  disabled?: boolean;
}

export const HistoricalEarthquakeSelector: React.FC<HistoricalEarthquakeSelectorProps> = ({
  onSelectEarthquake,
  selectedEarthquake,
  isLoading,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-blue-600" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">
              📊 Ejemplos de Sismos Reales
            </h3>
            <p className="text-xs text-gray-500">
              Sismos históricos de Japón, Chile, México, EEUU, Nueva Zelanda y más
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Info banner */}
          <div className="bg-blue-50 border-b border-blue-100 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Al seleccionar un sismo, se calculará automáticamente su <strong>frecuencia dominante</strong> y 
              se configurará la posición de biela recomendada.
            </p>
          </div>

          {/* Lista de sismos */}
          <div className="max-h-96 overflow-y-auto">
            {HISTORICAL_EARTHQUAKES.map((earthquake) => {
              const isSelected = selectedEarthquake?.id === earthquake.id;
              const isHovered = hoveredId === earthquake.id;

              return (
                <button
                  key={earthquake.id}
                  onClick={() => !disabled && onSelectEarthquake(earthquake)}
                  onMouseEnter={() => setHoveredId(earthquake.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  disabled={disabled || isLoading}
                  className={`
                    w-full p-4 text-left border-b border-gray-100 transition-all
                    ${isSelected 
                      ? 'bg-blue-100 border-l-4 border-l-blue-600' 
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }
                    ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {/* Título y ubicación */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                        {earthquake.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <MapPin className="w-3 h-3" />
                          {earthquake.location}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {earthquake.year}
                        </div>
                      </div>
                    </div>
                    
                    {/* Badge de magnitud */}
                    <div className={`
                      px-2 py-1 rounded-full text-xs font-bold
                      ${earthquake.magnitude >= 8.0 
                        ? 'bg-red-100 text-red-800' 
                        : earthquake.magnitude >= 7.0 
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    `}>
                      M{earthquake.magnitude.toFixed(1)}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        PGA: <span className="font-semibold">{earthquake.pga.toFixed(2)}g</span>
                      </span>
                    </div>
                  </div>

                  {/* Descripción (solo visible al hover o selección) */}
                  {(isHovered || isSelected) && earthquake.description && (
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                      {earthquake.description}
                    </p>
                  )}

                  {/* Indicador de selección */}
                  {isSelected && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-blue-700 font-semibold">
                      ✓ Sismo seleccionado
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer con loading state */}
          {isLoading && (
            <div className="bg-gray-50 p-3 border-t border-gray-200 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-gray-600">Cargando datos sísmicos...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoricalEarthquakeSelector;
