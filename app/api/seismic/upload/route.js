import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const deviceId = formData.get('deviceId') || 'LAB_01';

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    const seismicData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.toLowerCase().startsWith('time')) continue;
      
      const parts = line.split(',');
      if (parts.length >= 2) {
        const time = parseFloat(parts[0]);
        const amplitude = parseFloat(parts[1]);
        
        if (!isNaN(time) && !isNaN(amplitude)) {
          seismicData.push({
            time: parseFloat(time.toFixed(4)),
            amplitude: parseFloat(amplitude.toFixed(3))
          });
        }
      }
    }

    if (seismicData.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid data found' }, { status: 400 });
    }

    const duration = seismicData[seismicData.length - 1].time;
    const maxAmplitude = Math.max(...seismicData.map(d => Math.abs(d.amplitude)));

    const metadata = {
      totalPoints: seismicData.length,
      maxAmplitude: parseFloat(maxAmplitude.toFixed(3)),
      duration: parseFloat(duration.toFixed(2)),
      fileName: file.name,
      uploadedAt: new Date().toISOString()
    };

    console.log(`✅ Procesado: ${seismicData.length} puntos, ${duration.toFixed(2)}s`);

    // Solo devolver los datos al frontend
    // NO subir a Firebase (el ESP32 genera localmente)
    
    return NextResponse.json({
      success: true,
      message: 'Archivo procesado',
      data: seismicData,
      fileName: file.name,
      metadata: metadata
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
