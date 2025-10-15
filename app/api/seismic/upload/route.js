export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({
        success: false,
        message: 'No se recibió ningún archivo'
      }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Parsear CSV (formato: tiempo,amplitud)
    const data = lines.slice(1).map((line, index) => {
      const [time, amplitude] = line.split(',').map(val => parseFloat(val.trim()));
      return {
        time: time || index * 0.01,
        amplitude: amplitude || 0
      };
    }).filter(point => !isNaN(point.amplitude));

    return Response.json({
      success: true,
      message: `${data.length} puntos procesados`,
      data: data,
      fileName: file.name
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al procesar archivo: ' + error.message
    }, { status: 500 });
  }
}
