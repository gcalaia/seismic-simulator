/**
 * Calcula la frecuencia dominante basándose en la magnitud y características del sismo
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

  // Calcular PGA (Peak Ground Acceleration) - máxima amplitud
  const maxAmplitude = Math.max(...data.map(d => Math.abs(d.amplitude)));
  
  // Calcular energía del sismo (RMS - Root Mean Square)
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    sumSquares += data[i].amplitude * data[i].amplitude;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  
  console.log('📊 Análisis sísmico:', {
    PGA: maxAmplitude.toFixed(2) + 'mm',
    RMS: rms.toFixed(2) + 'mm',
    Duración: duration.toFixed(1) + 's',
    Muestras: data.length
  });

  // 🎯 MÉTODO EMPÍRICO: Frecuencia basada en características del sismo
  let frequency;
  
  // Relación empírica: sismos de larga duración (>50s) son de baja frecuencia
  if (duration > 50) {
    // Sismos grandes (M8-9): 0.5-1.5 Hz
    if (maxAmplitude > 15) {
      frequency = 0.8; // Sismo muy grande, baja frecuencia
    } else if (maxAmplitude > 10) {
      frequency = 1.2;
    } else {
      frequency = 1.5;
    }
  } else if (duration > 30) {
    // Sismos medianos-grandes (M7-8): 1.0-2.0 Hz
    if (maxAmplitude > 12) {
      frequency = 1.2;
    } else if (maxAmplitude > 8) {
      frequency = 1.5;
    } else {
      frequency = 1.8;
    }
  } else {
    // Sismos cortos (M6-7): 1.5-2.5 Hz
    if (maxAmplitude > 10) {
      frequency = 1.5;
    } else if (maxAmplitude > 6) {
      frequency = 2.0;
    } else {
      frequency = 2.5;
    }
  }
  
  // Ajuste fino basado en RMS (energía total)
  if (rms > 8) {
    frequency = frequency * 0.9; // Reducir frecuencia para alta energía
  } else if (rms < 4) {
    frequency = frequency * 1.1; // Aumentar frecuencia para baja energía
  }
  
  // Limitar al rango del sistema
  frequency = Math.min(2.5, Math.max(0.5, frequency));

  const period = 1 / frequency;
  const vulnerableFloors = Math.round(period / 0.1);
  const vulnerableBuildings = `Edificios de ~${vulnerableFloors} pisos (T ≈ ${period.toFixed(2)}s)`;

  // Contar cruces por cero (solo para mostrar)
  let zeroCrossings = 0;
  for (let i = 1; i < data.length; i++) {
    if (
      (data[i-1].amplitude > 0 && data[i].amplitude <= 0) ||
      (data[i-1].amplitude < 0 && data[i].amplitude >= 0)
    ) {
      zeroCrossings++;
    }
  }

  let recommendedPosition;
  
  if (frequency >= 2.5) {
    recommendedPosition = 2;
  } else if (frequency >= 1.8) {
    recommendedPosition = 3;
  } else if (frequency >= 1.2) {
    recommendedPosition = 4;
  } else {
    recommendedPosition = 5;
  }

  console.log('✅ Frecuencia estimada:', frequency.toFixed(2), 'Hz');
  console.log('📐 Período:', period.toFixed(2), 's');
  console.log('⚙️ Posición recomendada:', recommendedPosition);

  return {
    frequency,
    period,
    zeroCrossings,
    duration,
    vulnerableBuildings,
    recommendedPosition
  };
}
