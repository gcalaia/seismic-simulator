import { useState, useCallback } from 'react';
import { 
  parseSeismicCSV, 
  calculateDominantFrequency, 
  normalizeAmplitudes,
  SeismicDataPoint,
  DominantFrequencyResult 
} from './calculateDominantFrequency';

export interface HistoricalEarthquake {
  id: string;
  name: string;
  location: string;
  year: number;
  magnitude: number;
  pga: number; // Peak Ground Acceleration en g
  csvPath: string;
  description?: string;
}

interface UseHistoricalEarthquakeReturn {
  // Estado
  selectedEarthquake: HistoricalEarthquake | null;
  seismicData: SeismicDataPoint[] | null;
  dominantFreqResult: DominantFrequencyResult | null;
  isLoading: boolean;
  error: string | null;
  isHistoricalMode: boolean;
  
  // Métodos
  loadHistoricalEarthquake: (earthquake: HistoricalEarthquake) => Promise<void>;
  clearHistoricalMode: () => void;
}

export function useHistoricalEarthquake(): UseHistoricalEarthquakeReturn {
  const [selectedEarthquake, setSelectedEarthquake] = useState<HistoricalEarthquake | null>(null);
  const [seismicData, setSeismicData] = useState<SeismicDataPoint[] | null>(null);
  const [dominantFreqResult, setDominantFreqResult] = useState<DominantFrequencyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);

  /**
   * Carga un sismo histórico desde un archivo CSV
   */
  const loadHistoricalEarthquake = useCallback(async (earthquake: HistoricalEarthquake) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Cargar archivo CSV
      const response = await fetch(earthquake.csvPath);
      
      if (!response.ok) {
        throw new Error(`Error al cargar CSV: ${response.status} ${response.statusText}`);
      }

      const csvContent = await response.text();

      // 2. Parsear CSV
      let data = parseSeismicCSV(csvContent);

      if (data.length === 0) {
        throw new Error('El archivo CSV no contiene datos válidos');
      }

      // 3. Normalizar amplitudes al rango del DVSSE
      // Asumimos que la posición máxima de biela es 88mm (±44mm)
      data = normalizeAmplitudes(data, 44);

      // 4. Calcular frecuencia dominante
      const freqResult = calculateDominantFrequency(data);

      // 5. Actualizar estado
      setSelectedEarthquake(earthquake);
      setSeismicData(data);
      setDominantFreqResult(freqResult);
      setIsHistoricalMode(true);
      setIsLoading(false);

      // Log para debugging
      console.log('✅ Sismo histórico cargado:', {
        earthquake: earthquake.name,
        dataPoints: data.length,
        dominantFreq: freqResult.frequency.toFixed(2) + ' Hz',
        period: freqResult.period.toFixed(2) + ' s',
        recommendedPosition: freqResult.recommendedPosition,
        zeroCrossings: freqResult.zeroCrossings
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      setIsLoading(false);
      console.error('❌ Error al cargar sismo histórico:', err);
      
      // Limpiar estado en caso de error
      setSelectedEarthquake(null);
      setSeismicData(null);
      setDominantFreqResult(null);
      setIsHistoricalMode(false);
    }
  }, []);

  /**
   * Limpia el modo histórico y vuelve al modo manual
   */
  const clearHistoricalMode = useCallback(() => {
    setSelectedEarthquake(null);
    setSeismicData(null);
    setDominantFreqResult(null);
    setIsHistoricalMode(false);
    setError(null);
    
    console.log('🔓 Modo histórico desactivado, volviendo a modo manual');
  }, []);

  return {
    // Estado
    selectedEarthquake,
    seismicData,
    dominantFreqResult,
    isLoading,
    error,
    isHistoricalMode,
    
    // Métodos
    loadHistoricalEarthquake,
    clearHistoricalMode
  };
}

// ============================================================================
// LISTA DE SISMOS HISTÓRICOS DISPONIBLES
// ============================================================================

export const HISTORICAL_EARTHQUAKES: HistoricalEarthquake[] = [
  {
    id: 'tohoku-2011',
    name: 'Terremoto de Japón (Tohoku)',
    location: 'Japón',
    year: 2011,
    magnitude: 9.1,
    pga: 2.7,
    csvPath: '/data/earthquakes/tohoku_2011.csv',
    description: 'Terremoto más potente registrado en Japón. Generó un tsunami devastador.'
  },
  {
    id: 'chile-2010',
    name: 'Terremoto de Chile (Maule)',
    location: 'Chile',
    year: 2010,
    magnitude: 8.8,
    pga: 0.65,
    csvPath: '/data/earthquakes/chile_maule_2010.csv',
    description: 'Uno de los terremotos más fuertes de la historia de Chile.'
  },
  {
    id: 'mexico-2017',
    name: 'Terremoto de México (Puebla)',
    location: 'México',
    year: 2017,
    magnitude: 7.1,
    pga: 0.22,
    csvPath: '/data/earthquakes/mexico_puebla_2017.csv',
    description: 'Causó daños significativos en Ciudad de México debido a resonancia con suelo blando.'
  },
  {
    id: 'chichi-1999',
    name: 'Terremoto de Chi-Chi',
    location: 'Taiwán',
    year: 1999,
    magnitude: 7.6,
    pga: 0.44,
    csvPath: '/data/earthquakes/chichi_1999.csv',
    description: 'Produjo un desplazamiento de falla de hasta 9 metros.'
  },
  {
    id: 'christchurch-2011',
    name: 'Terremoto de Christchurch',
    location: 'Nueva Zelanda',
    year: 2011,
    magnitude: 6.2,
    pga: 1.41,
    csvPath: '/data/earthquakes/christchurch_2011.csv',
    description: 'A pesar de magnitud moderada, causó daños severos por proximidad al epicentro.'
  },
  {
    id: 'kobe-1995',
    name: 'Terremoto de Kobe',
    location: 'Japón',
    year: 1995,
    magnitude: 6.9,
    pga: 0.82,
    csvPath: '/data/earthquakes/kobe_1995.csv',
    description: 'Causó más de 6,000 muertes y reveló vulnerabilidades en diseño sísmico.'
  },
  {
    id: 'loma-prieta-1989',
    name: 'Terremoto de Loma Prieta',
    location: 'California, USA',
    year: 1989,
    magnitude: 6.9,
    pga: 0.41,
    csvPath: '/data/earthquakes/loma_prieta_1989.csv',
    description: 'Famoso por el colapso de la autopista Cypress en Oakland.'
  },
  {
    id: 'northridge-1994',
    name: 'Terremoto de Northridge',
    location: 'California, USA',
    year: 1994,
    magnitude: 6.7,
    pga: 0.84,
    csvPath: '/data/earthquakes/northridge_1994.csv',
    description: 'Uno de los terremotos más costosos en la historia de EE.UU.'
  },
  {
    id: 'san-fernando-1971',
    name: 'Terremoto de San Fernando',
    location: 'California, USA',
    year: 1971,
    magnitude: 6.6,
    pga: 1.23,
    csvPath: '/data/earthquakes/san_fernando_1971.csv',
    description: 'Llevó a mejoras significativas en códigos de construcción sísmicos.'
  },
  {
    id: 'darfield-2010',
    name: 'Terremoto de Darfield',
    location: 'Nueva Zelanda',
    year: 2010,
    magnitude: 7.1,
    pga: 0.83,
    csvPath: '/data/earthquakes/darfield_2010.csv',
    description: 'Terremoto de mayor magnitud registrado en Nueva Zelanda en 80 años.'
  }
];
