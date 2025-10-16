export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();

    const response = await fetch(`http://${ipAddress}:${port}/api/stop`, {
      method: 'POST',
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'Detenido'
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
