/**
 * Calcula la frecuencia dominante de un sismo mediante análisis de cruces por cero
 * 
 * Método:
 * 1. Cuenta cuántas veces la señal cruza por cero (cambio de signo)
 * 2. Frecuencia dominante = (Cruces por cero / 2) / Duración total
 * 
 * Nota: Este es un método simplificado apropiado para educación.
 * Para análisis profesional se usaría FFT (Transformada de Fourier).
 */

export interface SeismicDataPoint {
  time: number;      // Tiempo en segundos
  amplitude: number; // Amplitud en mm
}

export interface DominantFrequencyResult {
  frequency: number;           // Frecuencia dominante en Hz
  period: number;              // Período dominante en segundos
  zeroCrossings: number;       // Número de cruces por cero detectados
  duration: number;            // Duración total del registro en segundos
  vulnerableBuildings: string; // Descripción de estructuras vulnerables
  recommendedPosition: number; // Posición de biela recomendada (1-5)
}

/**
 * Calcula la frecuencia dominante de un conjunto de datos sísmicos
 */
export function calculateDominantFrequency(
  data: SeismicDataPoint[]
): DominantFrequencyResult {
  
  if (data.length < 2) {
    throw new Error('Se requieren al menos 2 puntos de datos para calcular frecuencia');
  }

  // 1. Calcular duración total
  const startTime = data[0].time;
  const endTime = data[data.length - 1].time;
  const duration = endTime - startTime;

  if (duration <= 0) {
    throw new Error('La duración del registro debe ser positiva');
  }

  // 2. Contar cruces por cero
  let zeroCrossings = 0;
  
  for (let i = 1; i < data.length; i++) {
    const prevAmplitude = data[i - 1].amplitude;
    const currAmplitude = data[i].amplitude;
    
    // Detectar cambio de signo (cruce por cero)
    if (
      (prevAmplitude > 0 && currAmplitude <= 0) ||
      (prevAmplitude < 0 && currAmplitude >= 0)
    ) {
      zeroCrossings++;
    }
  }

  // 3. Calcular frecuencia dominante
  // Cada ciclo completo tiene 2 cruces por cero (subida y bajada)
  const frequency = (zeroCrossings / 2) / duration;

  // 4. Calcular período
  const period = 1 / frequency;

  // 5. Determinar estructuras vulnerables
  // Regla empírica: T_edificio ≈ 0.1 × número_de_pisos
  const vulnerableFloors = Math.round(period / 0.1);
  const vulnerableBuildings = `Edificios de ~${vulnerableFloors} pisos (T ≈ ${period.toFixed(2)}s)`;

  // 6. Recomendar posición de biela según frecuencia
  // Posiciones: 1=24mm, 2=40mm, 3=56mm, 4=72mm, 5=88mm
  // Frecuencias altas (>3Hz) → posición baja (menor amplitud)
  // Frecuencias bajas (<1Hz) → posición alta (mayor amplitud)
  let recommendedPosition: number;
  
  if (frequency >= 4.0) {
    recommendedPosition = 1; // 24mm - Frecuencia muy alta
  } else if (frequency >= 2.5) {
    recommendedPosition = 2; // 40mm - Frecuencia alta
  } else if (frequency >= 1.5) {
    recommendedPosition = 3; // 56mm - Frecuencia media
  } else if (frequency >= 0.8) {
    recommendedPosition = 4; // 72mm - Frecuencia baja
  } else {
    recommendedPosition = 5; // 88mm - Frecuencia muy baja
  }

  return {
    frequency,
    period,
    zeroCrossings,
    duration,
    vulnerableBuildings,
    recommendedPosition
  };
}

/**
 * Parsea un archivo CSV de sismo y retorna los datos como array
 * Formato esperado: "tiempo,amplitud" (una línea por punto)
 */
export function parseSeismicCSV(csvContent: string): SeismicDataPoint[] {
  const lines = csvContent.trim().split('\n');
  const data: SeismicDataPoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Saltar líneas vacías o de encabezado
    if (!line || line.toLowerCase().includes('tiempo') || line.toLowerCase().includes('time')) {
      continue;
    }

    const parts = line.split(',');
    
    if (parts.length !== 2) {
      console.warn(`Línea ${i + 1} inválida, se omite: "${line}"`);
      continue;
    }

    const time = parseFloat(parts[0].trim());
    const amplitude = parseFloat(parts[1].trim());

    if (isNaN(time) || isNaN(amplitude)) {
      console.warn(`Línea ${i + 1} con valores no numéricos, se omite: "${line}"`);
      continue;
    }

    data.push({ time, amplitude });
  }

  if (data.length === 0) {
    throw new Error('No se pudieron extraer datos válidos del CSV');
  }

  return data;
}

/**
 * Normaliza amplitudes para que el máximo sea el valor especificado
 * Útil para escalar sismos reales al rango del DVSSE (±44mm máximo)
 */
export function normalizeAmplitudes(
  data: SeismicDataPoint[],
  maxAmplitude: number
): SeismicDataPoint[] {
  
  // Encontrar amplitud máxima absoluta actual
  const currentMax = Math.max(...data.map(d => Math.abs(d.amplitude)));
  
  if (currentMax === 0) {
    throw new Error('Todas las amplitudes son cero, no se puede normalizar');
  }

  // Factor de escala
  const scaleFactor = maxAmplitude / currentMax;

  // Aplicar escala
  return data.map(point => ({
    time: point.time,
    amplitude: point.amplitude * scaleFactor
  }));
}

/**
 * Ejemplo de uso:
 * 
 * const csvContent = `tiempo,amplitud
 * 0.00,-0.5
 * 0.01,0.3
 * 0.02,0.8
 * ...`;
 * 
 * const data = parseSeismicCSV(csvContent);
 * const result = calculateDominantFrequency(data);
 * 
 * console.log(`Frecuencia dominante: ${result.frequency.toFixed(2)} Hz`);
 * console.log(`Período: ${result.period.toFixed(2)} s`);
 * console.log(`Estructuras vulnerables: ${result.vulnerableBuildings}`);
 * console.log(`Posición recomendada de biela: ${result.recommendedPosition}`);
 */
