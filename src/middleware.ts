import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/', '/community', '/business', '/todos', '/clients'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if route needs protection
  const needsAuth = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  // Public routes that don't need auth
  if (pathname.startsWith('/api/webhooks') || pathname === '/login') {
    return NextResponse.next();
  }

  if (needsAuth) {
    const authCookie = request.cookies.get('mission-control-auth');
    
    if (!authCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
