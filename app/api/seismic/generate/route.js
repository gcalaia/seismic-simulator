export async function POST(request) {
  try {
    const { amplitude, frequency, duration, waveform } = await request.json();
    
    const points = [];
    const samples = duration * 100; // 100 samples per second
    
    for (let i = 0; i < samples; i++) {
      const t = i / 100;
      let amp = 0;
      
      switch (waveform) {
        case 'sine':
          amp = amplitude * Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          amp = amplitude * Math.sign(Math.sin(2 * Math.PI * frequency * t));
          break;
        case 'sawtooth':
          amp = amplitude * (2 * (t * frequency - Math.floor(t * frequency + 0.5)));
          break;
        case 'random':
          amp = amplitude * (Math.random() * 2 - 1);
          break;
        case 'chirp':
          // Frecuencia variable (barrido)
          const instantFreq = frequency * (1 + t / duration);
          amp = amplitude * Math.sin(2 * Math.PI * instantFreq * t);
          break;
        default:
          amp = 0;
      }
      
      points.push({
        time: parseFloat(t.toFixed(3)),
        amplitude: parseFloat(amp.toFixed(3))
      });
    }
    
    return Response.json({
      success: true,
      message: 'Onda generada correctamente',
      data: points,
      metadata: {
        amplitude,
        frequency,
        duration,
        waveform,
        samples: points.length
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al generar onda: ' + error.message
    }, { status: 500 });
  }
}
