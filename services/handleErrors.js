import { appenLoginWithCookieJar } from './appenLogin.js';

export const handleAuthError = async account => {
    const response = await appenLoginWithCookieJar(account).catch(error => error);
    return response;
};
