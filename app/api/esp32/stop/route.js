export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();

    const response = await fetch(`http://${ipAddress}:${port}/api/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    return Response.json({
      success: true,
      message: 'Simulación detenida'
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al detener: ' + error.message
    }, { status: 500 });
  }
}
