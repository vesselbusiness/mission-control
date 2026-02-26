import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Get password from environment variable
    const correctPassword = process.env.MISSION_CONTROL_PASSWORD || 'vessel2026';

    if (password === correctPassword) {
      const response = NextResponse.json({ success: true });
      
      // Set auth cookie (expires in 7 days)
      response.cookies.set('mission-control-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    } else {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
