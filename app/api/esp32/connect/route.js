export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();
    
    console.log('Intentando conectar a:', ipAddress, port);
    
    // Intentar conectar con el ESP32
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
    
    const response = await fetch(`http://${ipAddress}:${port}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    }).catch(error => {
      console.error('Error de fetch:', error);
      return null;
    });
    
    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json().catch(() => ({}));
      return Response.json({
        success: true,
        message: 'Conectado correctamente',
        deviceInfo: data
      });
    }

    return Response.json({
      success: false,
      message: 'No se pudo conectar con el ESP32'
    }, { status: 400 });

  } catch (error) {
    console.error('Error en connect route:', error);
    return Response.json({
      success: false,
      message: 'Error de conexión: ' + error.message
    }, { status: 500 });
  }
}