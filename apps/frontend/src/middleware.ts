import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicRoute,
  isAuthRoute,
  isApiRoute,
  isProtectedRoute,
  ROUTE_CONFIG,
} from "@/lib/routes";

// Decodificador basico de JWT compativel com Edge Runtime (atob)
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  // Ignorar rotas de API do proprio Next (ex: /api/auth) e static assets
  if (isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Verificacao de cookies COM validacao de expiracao (previne cookies fake/stale)
  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  let isAccessValid = false;
  let isRefreshValid = false;

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (accessToken) {
    const payload = parseJwt(accessToken);
    if (payload && payload.exp && payload.exp > nowSeconds) {
      isAccessValid = true;
    }
  }

  isRefreshValid = typeof refreshToken === "string" && refreshToken.trim().length > 0;
  
  // Access token pode ser validado localmente; refresh token e opaco e vale pela presenca do cookie.
  const isLoggedIn = isAccessValid || isRefreshValid;

  // Se usuario ESTÁ logado, nao deve acessar rotas de autenticacao (ex: /login)
  if (isAuthRoute(pathname)) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(ROUTE_CONFIG.authenticatedFallback, nextUrl));
    }
    return NextResponse.next();
  }

  // Se for uma rota publica comum (ex: home "/")
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Tratativa final: Rotas Protegidas (tudo que sobrou)
  if (isProtectedRoute(pathname)) {
    if (!isLoggedIn) {
      // Cria a URL de login
      const loginUrl = new URL(ROUTE_CONFIG.unauthenticatedFallback, nextUrl);
      
      // Adicionar a URL original no callbackUrl para redirecionar depois
      loginUrl.searchParams.set("callbackUrl", pathname);

      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

/**
 * Matcher otimizado para nao rodar o middleware em arquivos estaticos, 
 * imagens, manifest, favicons, _next/static, etc.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, pwa.svg, manifest.json (specific static assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|pwa.svg|manifest.json|.*\\.(?:ico|png|jpg|jpeg|svg|webp)$).*)",
  ],
};
