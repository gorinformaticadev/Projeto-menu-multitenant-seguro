export const ROUTE_CONFIG = {
  /** Rotas que usuarios sem login podem acessar libremente */
  publicRoutes: [
    "/",
  ],

  /** Rotas exclusivas para autenticacao (se o usuario estiver logado, sera redirecionado para dashboard) */
  authRoutes: [
    "/login",
    "/esqueci-senha",
    "/redefinir-senha",
  ],

  /** Prefixo padrao de rotas da API onde o Next.js lida e repassa (nao protegemos via middleware do front para acessar) */
  apiPrefix: "/api",

  /** Onde enviar o usuario que nao tem sessao e tenta acessar rota privada */
  unauthenticatedFallback: "/login",

  /** Onde enviar o usuario que JÁ tem sessao e tenta acessar login/registro */
  authenticatedFallback: "/dashboard",
};

/** 
 * Verifica se o caminho atual e de uma rota publica ou publica/auth 
 */
export const isPublicRoute = (pathname: string) => {
  return ROUTE_CONFIG.publicRoutes.includes(pathname);
};

export const isAuthRoute = (pathname: string) => {
  return ROUTE_CONFIG.authRoutes.includes(pathname);
};

export const isApiRoute = (pathname: string) => {
  return pathname.startsWith(ROUTE_CONFIG.apiPrefix);
};

/**
 * Utilitario para saber se a rota ATUAL exige bloqueio.
 * Todas as rotas que nao sao explicitamente publicas, auth, ou api, sao tratadas como PROTEGIDAS.
 */
export const isProtectedRoute = (pathname: string) => {
  return !isPublicRoute(pathname) && !isAuthRoute(pathname) && !isApiRoute(pathname);
};

/**
 * Valida se uma URL de retorno é segura para redirecionamento (previne Open Redirect).
 * Deve começar com '/' e NÃO pode ser '//' (que indica protocolo relativo).
 */
export const isSafeCallbackUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//');
};
