import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const deviceId = formData.get('deviceId') || 'LAB_01';

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    console.log(`📄 Procesando: ${file.name} (${file.size} bytes)`);

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    console.log(`📝 Total líneas: ${lines.length}`);
    
    const seismicData = [];
    let skippedLines = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Saltar líneas vacías, comentarios y header
      if (!line || line.startsWith('#') || line.toLowerCase().includes('time')) {
        skippedLines++;
        continue;
      }
      
      // Separar por coma o espacio
      const parts = line.split(/[,\s\t]+/).filter(p => p.trim());
      
      if (parts.length >= 2) {
        const time = parseFloat(parts[0]);
        const amplitude = parseFloat(parts[1]);
        
        if (!isNaN(time) && !isNaN(amplitude)) {
          seismicData.push({
            time: parseFloat(time.toFixed(4)),
            amplitude: parseFloat(amplitude.toFixed(3))
          });
        } else {
          console.log(`⚠️ Línea ${i} inválida: ${line}`);
        }
      }
    }

    console.log(`✅ ${seismicData.length} puntos válidos (${skippedLines} líneas saltadas)`);

    if (seismicData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No se encontraron datos válidos en el archivo. Verifica que tenga formato: tiempo,amplitud' 
      }, { status: 400 });
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

    console.log(`📊 Metadata:`, metadata);

    return NextResponse.json({
      success: true,
      message: 'Archivo procesado correctamente',
      data: seismicData,
      fileName: file.name,
      metadata: metadata
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
