import React from 'react';
import { Info, AlertTriangle, Building2, Waves } from 'lucide-react';
import { DominantFrequencyResult } from './calculateDominantFrequency';

interface EducationalNoteProps {
  earthquakeName: string;
  magnitude: number;
  location: string;
  year: number;
  pga: number; // Peak Ground Acceleration en g
  dominantFreqResult: DominantFrequencyResult;
}

export const EducationalNote: React.FC<EducationalNoteProps> = ({
  earthquakeName,
  magnitude,
  location,
  year,
  pga,
  dominantFreqResult
}) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4 shadow-md">
      {/* Encabezado */}
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-blue-500 rounded-full p-2 flex-shrink-0">
          <Info className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-blue-900 mb-1">
            📊 Nota Educativa - Espectro de Respuesta
          </h3>
          <p className="text-sm text-blue-700">
            {earthquakeName} ({year}) - {location}
          </p>
        </div>
      </div>

      {/* Información del sismo */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-gray-600 mb-1">Magnitud</div>
          <div className="text-xl font-bold text-blue-900">M{magnitude.toFixed(1)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-gray-600 mb-1">PGA (Aceleración máxima)</div>
          <div className="text-xl font-bold text-blue-900">{pga.toFixed(2)}g</div>
        </div>
      </div>

      {/* Cómo se calculó la frecuencia */}
      <div className="bg-white rounded-lg p-4 border border-blue-200 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Waves className="w-5 h-5 text-indigo-600" />
          <h4 className="font-semibold text-gray-800">Frecuencia Dominante Calculada</h4>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Cruces por cero detectados:</span>
            <span className="font-semibold text-gray-900">{dominantFreqResult.zeroCrossings}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duración del registro:</span>
            <span className="font-semibold text-gray-900">{dominantFreqResult.duration.toFixed(1)}s</span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Frecuencia dominante:</span>
              <span className="text-2xl font-bold text-indigo-600">
                {dominantFreqResult.frequency.toFixed(2)} Hz
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-700 font-medium">Período dominante:</span>
              <span className="text-xl font-bold text-indigo-600">
                {dominantFreqResult.period.toFixed(2)} s
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 italic">
          💡 Método: Análisis de cruces por cero. Frecuencia = (Cruces / 2) / Duración
        </div>
      </div>

      {/* Estructuras vulnerables */}
      <div className="bg-amber-50 rounded-lg p-4 border border-amber-300 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-5 h-5 text-amber-700" />
          <h4 className="font-semibold text-amber-900">Estructuras Más Vulnerables</h4>
        </div>
        <p className="text-sm text-amber-800 mb-2">
          {dominantFreqResult.vulnerableBuildings}
        </p>
        <p className="text-xs text-amber-700 italic">
          Las estructuras cuyo período natural coincide con el período dominante del sismo 
          experimentan resonancia y amplificación significativa de movimiento.
        </p>
      </div>

      {/* Limitación del sistema */}
      <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-400">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-900 mb-2">
              ⚠️ Limitación del Sistema DVSSE
            </h4>
            <div className="text-sm text-yellow-800 space-y-2">
              <p>
                <strong>Este sistema reproduce solo la frecuencia dominante promedio</strong> del 
                sismo mediante movimiento armónico simple (senoidal).
              </p>
              <p>
                Los sismos reales contienen <strong>múltiples frecuencias simultáneas</strong> (espectro 
                de respuesta completo) que varían en el tiempo. El DVSSE <strong>no puede replicar</strong> esta 
                complejidad con su configuración actual de 1 grado de libertad.
              </p>
              <p className="font-semibold text-yellow-900">
                ✅ Válido para: Comprender principios de resonancia, comparar diferentes sismos, 
                observar efectos en diferentes estructuras
              </p>
              <p className="font-semibold text-yellow-900">
                ❌ No válido para: Validación cuantitativa exacta de diseños estructurales, 
                certificación de resistencia sísmica
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Posición de biela recomendada */}
      <div className="mt-4 bg-green-50 rounded-lg p-3 border border-green-300">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-green-700 mb-1">Posición de biela recomendada</div>
            <div className="text-2xl font-bold text-green-800">
              Posición {dominantFreqResult.recommendedPosition}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-green-700 mb-1">Amplitud correspondiente</div>
            <div className="text-xl font-bold text-green-800">
              {[24, 40, 56, 72, 88][dominantFreqResult.recommendedPosition - 1]}mm
            </div>
          </div>
        </div>
        <p className="text-xs text-green-700 mt-2">
          Esta posición fue seleccionada automáticamente según la frecuencia del sismo para 
          optimizar la simulación.
        </p>
      </div>
    </div>
  );
};

export default EducationalNote;
