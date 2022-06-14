export const CSRF_URL = 'https://feca-proxy.appen.com/v1/authentication/csrf';
export const CONTRIBUTOR_AUTH_URL = 'https://feca-proxy.appen.com/v1/authentication';
export const CONTRIBUTOR_IFRAME_URL = 'https://feca-proxy.appen.com/v1/tasks/iframe_url';
export const APPEN_SESSION_URL = 'https://account.appen.com/sessions/new';
export const APPEN_AUTH_URL = 'https://account.appen.com/sessions';
export const CONTRIBUTOR_ME_URL = 'https://feca-proxy.appen.com/v1/users/me';
export const PAYMENT_SUMMARY_URL = 'https://feca-proxy.appen.com/v1/users/payments_summary';
export const WITHDRAW_URL = 'https://feca-proxy.appen.com/v1/withdraws';
export const KEYCLOAK_URL = 'https://feca-proxy.appen.com/auth/keycloak';

// HEADERS
export const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';
export const ACCEPT_HEADER =
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9';
export const APPEN_BASIC_HEADERS = {
    headers: {
        'User-Agent': USER_AGENT,
        accept: ACCEPT_HEADER,
    },
};
export const APPEN_AUTH_HEADERS = {
    headers: {
        'User-Agent': USER_AGENT,
        accept: ACCEPT_HEADER,
        'Content-Type': 'application/x-www-form-urlencoded',
    },
};
