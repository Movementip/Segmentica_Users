const normalizeBaseUrl = (value: string): string => String(value || '').trim().replace(/\/+$/, '');

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', 'host.docker.internal'] as const;

const parseExtraUrls = (value: string): string[] =>
    String(value || '')
        .split(',')
        .map((part) => normalizeBaseUrl(part))
        .filter(Boolean);

const buildVariants = (rawUrl: string): string[] => {
    const normalized = normalizeBaseUrl(rawUrl);
    if (!normalized) return [];

    const variants = new Set<string>([normalized]);

    try {
        const parsed = new URL(normalized);
        if (!LOCAL_HOSTS.includes(parsed.hostname as (typeof LOCAL_HOSTS)[number])) {
            return [...variants];
        }

        const portsToTry = new Set<string>([parsed.port || (parsed.protocol === 'https:' ? '443' : '80')]);
        if (parsed.port === '3010') {
            portsToTry.add('3001');
        } else if (parsed.port === '3001') {
            portsToTry.add('3010');
        }

        for (const host of LOCAL_HOSTS) {
            for (const port of portsToTry) {
                const candidate = new URL(parsed.toString());
                candidate.hostname = host;
                candidate.port = port;
                variants.add(normalizeBaseUrl(candidate.toString()));
            }
        }
    } catch {
        return [...variants];
    }

    return [...variants];
};

export const getDocumentRendererBaseUrls = (): string[] => {
    const configuredUrl = normalizeBaseUrl(process.env.DOCUMENT_RENDERER_URL || '');
    const fallbackUrls = parseExtraUrls(process.env.DOCUMENT_RENDERER_FALLBACK_URLS || '');
    const urls = new Set<string>();

    for (const value of [configuredUrl, ...fallbackUrls]) {
        for (const variant of buildVariants(value)) {
            urls.add(variant);
        }
    }

    return [...urls];
};

export const hasDocumentRenderer = (): boolean => getDocumentRendererBaseUrls().length > 0;

export const buildDocumentRendererError = (operation: string, attempts: string[]): Error => {
    const details = attempts.length > 0 ? ` Попытки: ${attempts.join(' | ')}` : '';
    return new Error(
        `Document renderer is unavailable while trying to ${operation}. Проверьте DOCUMENT_RENDERER_URL и доступность сервиса рендера.${details}`
    );
};
