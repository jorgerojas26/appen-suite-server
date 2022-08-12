import { CONTRIBUTOR_IFRAME_URL } from '../constants.js';
import { appenLoginWithRetry } from './appenLogin.js';
import { JSDOM } from 'jsdom';

export const GET_APPEN_TASK_LIST = async (account, req, userId) => {
    if (!req.app.locals.iframe_url) {
        const iframe_url = await get_new_iframe_url(account, req);
        if (!iframe_url && account.loginAttempts === 3) {
            req.app.locals.accounts_info[userId].scraping_stopped = true;
            return [];
        }
        return GET_APPEN_TASK_LIST(account, req, userId);
    }

    const taskListResponse = await account
        .axiosInstance({
            method: 'GET',
            url: req.app.locals.iframe_url,
        })
        .catch(error => error);

    if (taskListResponse.response?.status === 401) {
        let loginResponse = await appenLoginWithRetry(account);
        if (!loginResponse.error) return GET_APPEN_TASK_LIST(account, req, userId);
    }

    if (taskListResponse.response?.status === 403) {
        await get_new_iframe_url(account, req, userId);
        return GET_APPEN_TASK_LIST(account, req, userId);
    }

    const task_list = extract_task_list(taskListResponse.data);

    return task_list;
};

const get_new_iframe_url = async (account, req, userId) => {
    const iframe_url_response = await account.axiosInstance(CONTRIBUTOR_IFRAME_URL).catch(error => error);

    // Session expired or not logged in
    if (iframe_url_response.response?.status === 401) {
        let loginResponse = await appenLoginWithRetry(account);
        if (!loginResponse.error) return GET_APPEN_TASK_LIST(account, req, userId);
    }

    req.app.locals.iframe_url = iframe_url_response?.data?.url;
    return iframe_url_response?.data?.url;
};

const extract_task_list = html => {
    const dom = new JSDOM(html);

    const task_list = dom.window.document.querySelector('[data-tasks]');
    const task_list_json = task_list.getAttribute('data-tasks');
    const task_list_json_parsed = JSON.parse(task_list_json);

    return task_list_json_parsed;
};

