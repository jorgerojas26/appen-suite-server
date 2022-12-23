import Account from '../models/account.js';
import Favorite from '../models/favorite.js';
import Proxy from '../models/proxy.js';
import fs from 'fs';
import axios from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { FileCookieStore } from 'tough-cookie-file-store';
import path from 'path';
import { appenLoginWithRetry } from '../services/appenLogin.js';
import { mutateTaskData, getTaskValue } from '../services/appenTask.js';
import { APPEN_BASIC_HEADERS } from '../constants.js';
import HttpsProxyAgent from 'https-proxy-agent';

axiosCookieJarSupport.wrapper(axios);

const readOrCreateCookiesFileForEachAccount = async accounts => {
    accounts.forEach(async account => {
        const filename = path.resolve('./config/cookies', account.email);

        try {
            fs.readFileSync(filename);
        } catch (err) {
            try {
                fs.writeFileSync(filename, '');
            } catch (err) {
                console.log(err);
            }
        }
    });
};

const createSessionForEachAccount = accounts => {
    return accounts.map(account => {
        const filename = path.resolve('./config/cookies', account.email);
        let cookieJar = new CookieJar(new FileCookieStore(filename));
        const instance = axios.create({
            withCredentials: true,
            jar: cookieJar,
            // httpAgent: new HttpsProxyAgent(account.proxy),
        });
        /*
    const fetch = fetchCookie(
      nodeFetch,
      new fetchCookie.toughCookie.CookieJar(),
    );
    */
        account.axiosInstance = instance;
        account.cookieJar = cookieJar;

        return account;
    });
};

export const setupAppenAccounts = async req => {
    const userId = req.auth.user.id;

    try {
        let accounts = await Account.find({ userId });
        const favorites = await Favorite.find({ userId });

        const proxies = (await Proxy.find({ userId })) || [];

        console.log('start configuring cookies');
        readOrCreateCookiesFileForEachAccount(accounts);
        console.log('end configuring cookies');

        accounts = accounts.map(account => {
            const cached_data = req.app.locals.accounts_info[userId].accounts.find(a => a.email === account.email);

            return {
                ...account.toObject(),
                favorites: favorites.map(favorite => {
                    const disabled_favorites = account.disabled_favorites;

                    return {
                        ...favorite.toObject(),
                        active: !disabled_favorites.includes(favorite._id.toString()),
                    };
                }),
                current_collecting_tasks: [],
                tasks_waiting_for_resolution: [],
                loginAttempts: 0,
                start_collecting: function({ id, name, level, payout, url, scraping_delay }) {
                    const taskExists = this.current_collecting_tasks.find(task => task.id === id);
                    const collect = this.collect;
                    const accountThis = this;

                    if (taskExists) {
                        this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'collecting');
                        this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'url', url);
                    } else {
                        const taskObject = {
                            id,
                            name,
                            level,
                            payout,
                            url,
                            status: 'collecting',
                            error_text: '',
                            fetch_count: 0,
                            pause: function() {
                                this.status = 'paused';
                            },
                            resume: function() {
                                this.status = 'collecting';
                                console.log('Resuming task', this.id, this.name);
                                collect.call(accountThis, { task_id: this.id, scraping_delay });
                            },
                        };
                        this.current_collecting_tasks.push(taskObject);
                    }

                    this.collect.call(this, { task_id: id, scraping_delay });
                },
                collect: async function({ task_id, scraping_delay }) {
                    const task = this.current_collecting_tasks.find(task => task?.id === task_id);
                    const waiting_for_resolution = this.tasks_waiting_for_resolution.find(task => task?.id === task_id);

                    if (waiting_for_resolution?.status === 'opened-in-browser') {
                        this.current_collecting_tasks = mutateTaskData(
                            this.current_collecting_tasks,
                            task_id,
                            'status',
                            'opened-in-browser'
                        );
                    } else {
                        if (task) {
                            const { id, name, level, payout, url, ...other } = task;

                            try {
                                const response = await this.axiosInstance(url, {
                                    ...APPEN_BASIC_HEADERS,
                                }).catch(err => err);

                                const { data } = response;
                                const response_url = response.request?.res?.responseUrl;

                                if (response_url.includes('identity.appen.com') || response?.response?.status === 404) {
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'error_text',
                                        'Session expired'
                                    );
                                    if (!this.loggingIn) {
                                        const loginResponse = await appenLoginWithRetry(this);

                                        if (!loginResponse.error) {
                                            console.log('Login successful', this.email);
                                            setTimeout(() => {
                                                this.collect.call(this, { task_id: id, scraping_delay });
                                            }, scraping_delay);
                                        }
                                    }
                                } else if (response_url.includes('view.appen.io')) {
                                    // TODO: Send task to the browser
                                    console.log('Task', task_id, name, 'collected');
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'status',
                                        'waiting-for-resolution'
                                    );

                                    const proxies = req.app.locals.accounts_info[req.auth.user.id].proxies;
                                    const current_busy_proxies = req.app.locals.accounts_info[req.auth.user.id].current_busy_proxies;

                                    let proxy = proxies.find(proxy => !current_busy_proxies.includes(proxy._id));

                                    if (!proxy) {
                                        proxy = proxies[Math.floor(Math.random() * proxies.length)];
                                    } else {
                                        req.app.locals.accounts_info[req.auth.user.id].current_busy_proxies.push(proxy._id);
                                    }

                                    this.tasks_waiting_for_resolution.push({
                                        id,
                                        name,
                                        url,
                                        ...other,
                                        status: 'waiting-for-resolution',
                                        proxy,
                                    });
                                } else if (data && data.includes('completed all your work')) {
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'status',
                                        'completed'
                                    );
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'error_text',
                                        'completed all your work'
                                    );
                                } else if (data && data.includes('maximum')) {
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'status',
                                        'maximum'
                                    );
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'error_text',
                                        'maximum number of tasks'
                                    );
                                } else if (data && data.includes('Expired')) {
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'status',
                                        'expired'
                                    );
                                    this.current_collecting_tasks = mutateTaskData(
                                        this.current_collecting_tasks,
                                        task_id,
                                        'error_text',
                                        'task link expired'
                                    );
                                } else {
                                    const status = getTaskValue(this.current_collecting_tasks, task_id, 'status');

                                    if (status === 'collecting') {
                                        this.current_collecting_tasks = mutateTaskData(
                                            this.current_collecting_tasks,
                                            task_id,
                                            'error_text',
                                            ''
                                        );
                                        this.current_collecting_tasks = mutateTaskData(
                                            this.current_collecting_tasks,
                                            task_id,
                                            'fetch_count',
                                            this.current_collecting_tasks.find(task => task.id === task_id).fetch_count + 1
                                        );
                                        setTimeout(() => {
                                            this.collect.call(this, { task_id, scraping_delay });
                                        }, scraping_delay);
                                    }
                                }
                            } catch (err) {
                                this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, task_id, 'status', 'error');
                                this.current_collecting_tasks = mutateTaskData(
                                    this.current_collecting_tasks,
                                    task_id,
                                    'error_text',
                                    err.message
                                );
                                console.error(`Account ${this.email} failed to collect ${task_id} - ${name}: ${err}`);
                            }
                        }
                    }
                },
                ...cached_data,
            };
        });

        accounts = createSessionForEachAccount(accounts);

        return { accounts, proxies };
    } catch (error) {
        console.error(error);
    }
};
