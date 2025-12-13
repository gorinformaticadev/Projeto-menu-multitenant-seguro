// Re-export do sistema de rate limiting do core
export { 
    globalRequestLimiter, 
    useRequestLimiter,
    default as RequestLimiter 
} from '../../../core/frontend/src/lib/request-limiter';