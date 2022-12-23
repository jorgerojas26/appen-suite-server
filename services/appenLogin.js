import { KEYCLOAK_URL, APPEN_BASIC_HEADERS, APPEN_AUTH_HEADERS, CONTRIBUTOR_ME_URL, CONTRIBUTOR_IFRAME_URL } from '../constants.js';
import { JSDOM } from 'jsdom';
import { URLSearchParams } from 'url';
import Account from '../models/account.js';

const get_keycloak_action_url = async account => {
    const keycloak_response = await account.axiosInstance(KEYCLOAK_URL, APPEN_BASIC_HEADERS);
    const identity_url = keycloak_response.data.redirectUrl;
    const identity_response = await account.axiosInstance(identity_url);
    const html = identity_response.data;
    const dom = new JSDOM(html);
    const action = dom.window.document.querySelector('form')?.action;
    return action;
};

const signIn = async (account, login_url) => {
    const params = new URLSearchParams();
    params.append('username', account.email);
    params.append('password', account.password);
    params.append('rememberMe', 'on');
    params.append('credentialId', '');

    const login_response = await account.axiosInstance.post(login_url, params, APPEN_AUTH_HEADERS);
    const credentials_valid = are_credentials_valid(login_response);
    if (!credentials_valid) return { error: 'Invalid credentials' };

    return login_response;
};

const are_credentials_valid = login_response => {
    if (login_response?.response?.status === 400) return false;

    return !login_response.data.includes('Invalid username or password');
};

const set_feca_proxy_cookies = async (login_response_url, account) => {
    const state = login_response_url.searchParams.get('state');
    const session_state = login_response_url.searchParams.get('session_state');
    const code = login_response_url.searchParams.get('code');
    const feca_proxy_response = await account.axiosInstance(
        `https://feca-proxy.appen.com/auth/keycloak/callback?state=${state}&session_state=${session_state}&code=${code}`
    );
    const annotate_response = await account.axiosInstance(CONTRIBUTOR_IFRAME_URL);
    const iframe_response = await account.axiosInstance(annotate_response?.data?.url);

    return iframe_response;
};

export const is_account_banned = async account => {
    const account_response = await account.axiosInstance('https://account.appen.com', APPEN_BASIC_HEADERS);
    const account_response_url = account_response.request.res.responseUrl;
    const is_banned = account_response_url.includes('banned');
    return is_banned;
};

export const appenLoginWithCookieJar = async account => {
    console.log('Logging in...' + account.email + ' ' + account.password);
    const keycloak_action = await get_keycloak_action_url(account);
    if (!keycloak_action) return { error: 'Could not get keycloak action' };

    const login_response = await signIn(account, keycloak_action);
    if (login_response?.error) return login_response;

    const login_response_url = new URL(login_response.request.res.responseUrl);
    const feca_proxy_response = await set_feca_proxy_cookies(login_response_url, account);
    // console.log('Feca proxy response', feca_proxy_response.data);

    const banned = await is_account_banned(account);

    if (banned) account.status = 'banned';

    return feca_proxy_response.data;
};

export const appenLoginWithRetry = async account => {
    account.loggingIn = true;
    const login_response = await appenLoginWithCookieJar(account);
    console.log('Login response', login_response);

    if (login_response?.error) {
        console.log('login error', login_response.error);
        account.loginError = login_response.error;
        if (account.status === 'active' && account.loginAttempts < 3) {
            account.loginAttempts++;
            console.log('Account ' + account.email + ' Retry logging in for ' + account.loginAttempts + ' time');
            return appenLoginWithRetry(account);
        } else {
            console.log('Account ' + account.email + ' is inactive');
            account.status = 'inactive';
            //account.loginAttempts = 0;
            account.loggingIn = false;
            await Account.updateOne({ email: account.email }, { $set: { status: 'inactive' } });
        }
        return login_response;
    } else {
        account.loggingIn = false;
    }
    return login_response;
};
