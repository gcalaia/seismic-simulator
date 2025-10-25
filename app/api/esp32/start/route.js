export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();

    console.log('Start:', ipAddress, port);

    const response = await fetch(`http://${ipAddress}:${port}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);

    if (response && response.ok) {
      return Response.json({
        success: true,
        message: 'Simulación iniciada'
      });
    }

    return Response.json({
      success: false,
      message: 'Error al iniciar'
    }, { status: 400 });

  } catch (error) {
    console.error('Error en start:', error);
    return Response.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}