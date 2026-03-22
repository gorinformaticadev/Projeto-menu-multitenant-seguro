export const ROUTE_CONFIG = {
  publicRoutes: [
    "/",
  ],
  authRoutes: [
    "/login",
    "/esqueci-senha",
    "/redefinir-senha",
  ],
  apiPrefix: "/api",
  unauthenticatedFallback: "/login",
  authenticatedFallback: "/dashboard",
};

export const isPublicRoute = (pathname: string) => {
  return ROUTE_CONFIG.publicRoutes.includes(pathname);
};

export const isAuthRoute = (pathname: string) => {
  return ROUTE_CONFIG.authRoutes.includes(pathname);
};

export const isApiRoute = (pathname: string) => {
  return pathname.startsWith(ROUTE_CONFIG.apiPrefix);
};

export const isProtectedRoute = (pathname: string) => {
  return !isPublicRoute(pathname) && !isAuthRoute(pathname) && !isApiRoute(pathname);
};

export const isSafeCallbackUrl = (url?: string | null): boolean => {
  if (!url) {
    return false;
  }

  return url.startsWith("/") && !url.startsWith("//");
};
