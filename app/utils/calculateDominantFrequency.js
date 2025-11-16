/**
 * Calcula la frecuencia dominante de un sismo mediante análisis de cruces por cero
 */

export function calculateDominantFrequency(data) {
  
  if (data.length < 2) {
    throw new Error('Se requieren al menos 2 puntos de datos');
  }

  const startTime = data[0].time;
  const endTime = data[data.length - 1].time;
  const duration = endTime - startTime;

  if (duration <= 0) {
    throw new Error('La duración del registro debe ser positiva');
  }

  let zeroCrossings = 0;
  
  for (let i = 1; i < data.length; i++) {
    const prevAmplitude = data[i - 1].amplitude;
    const currAmplitude = data[i].amplitude;
    
    if (
      (prevAmplitude > 0 && currAmplitude <= 0) ||
      (prevAmplitude < 0 && currAmplitude >= 0)
    ) {
      zeroCrossings++;
    }
  }

  const frequency = (zeroCrossings / 2) / duration;
  const period = 1 / frequency;
  const vulnerableFloors = Math.round(period / 0.1);
  const vulnerableBuildings = `Edificios de ~${vulnerableFloors} pisos (T ≈ ${period.toFixed(2)}s)`;

  let recommendedPosition;
  
  if (frequency >= 4.0) {
    recommendedPosition = 1;
  } else if (frequency >= 2.5) {
    recommendedPosition = 2;
  } else if (frequency >= 1.5) {
    recommendedPosition = 3;
  } else if (frequency >= 0.8) {
    recommendedPosition = 4;
  } else {
    recommendedPosition = 5;
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
