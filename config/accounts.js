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

axiosCookieJarSupport.wrapper(axios);

const readOrCreateCookiesFileForEachAccount = accounts => {
    for (let account of accounts) {
        const filename = path.resolve('./config/cookies', account.email);
        fs.readFile(filename, err => {
            if (err) {
                fs.writeFile(filename, '', (err, data) => {
                    if (err) console.error(err);
                });
            }
        });
    }
};

const createSessionForEachAccount = accounts => {
    for (let account of accounts) {
        const filename = path.resolve('./config/cookies', account.email);
        let cookieJar = new CookieJar(new FileCookieStore(filename));
        const instance = axios.create({
            withCredentials: true,
            jar: cookieJar,
        });
        /*
    const fetch = fetchCookie(
      nodeFetch,
      new fetchCookie.toughCookie.CookieJar(),
    );
    */
        account.axiosInstance = instance;
        account.cookieJar = cookieJar;
    }
};

export const setupAppenAccounts = async req => {
    const userId = req.auth.user.id;

    try {
        let accounts = await Account.find({ userId });
        const favorites = await Favorite.find({ userId });

        const proxies = (await Proxy.find({ userId })) || [];

        readOrCreateCookiesFileForEachAccount(accounts);

        accounts = accounts.map(account => {
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
                start_collecting: function ({ id, name, level, payout, url }) {
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
                            fetch_count: 0,
                            pause: function () {
                                if (this.status === 'collecting' || this.status === 'waiting-for-resolution') {
                                    this.status = 'paused';
                                }
                            },
                            resume: function () {
                                this.status = 'collecting';
                                console.log('Resuming task', this.id, this.name);
                                collect.call(accountThis, this.id);
                            },
                        };
                        this.current_collecting_tasks.push(taskObject);
                    }

                    this.collect.call(this, id);
                },
                collect: async function (id) {
                    const { name, url, ...other } = this.current_collecting_tasks.find(task => task.id === id);

                    try {
                        const response = await this.axiosInstance.get(url).catch(err => err);
                        const { data } = response;
                        const response_url = response.request.res.responseUrl;

                        if (response?.response?.status === 404) {
                            if (!this.loggingIn) {
                                console.log(`Account ${this.email} is not logged in. Trying to login...`);
                                const login = await appenLoginWithRetry(this);
                                if (!login.error) {
                                    setTimeout(() => {
                                        this.collect(id);
                                    }, 1000);
                                }
                            }
                        } else if (response_url.includes('view.appen.io')) {
                            // TODO: Send task to the browser
                            console.log('Task', id, name, 'collected');
                            this.current_collecting_tasks = mutateTaskData(
                                this.current_collecting_tasks,
                                id,
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

                            this.tasks_waiting_for_resolution.push({ name, url, ...other, proxy });
                        } else if (data && data.includes('completed all your work')) {
                            this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'completed');
                        } else if (data && data.includes('maximum')) {
                            this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'maximum');
                        } else if (data && data.includes('Expired')) {
                            this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'expired');
                        } else {
                            const status = getTaskValue(this.current_collecting_tasks, id, 'status');

                            if (status === 'collecting') {
                                this.current_collecting_tasks = mutateTaskData(
                                    this.current_collecting_tasks,
                                    id,
                                    'fetch_count',
                                    this.current_collecting_tasks.find(task => task.id === id).fetch_count + 1
                                );
                                setTimeout(() => {
                                    this.collect(id);
                                }, 1000);
                            }
                        }
                    } catch (err) {
                        console.log('error', err);
                        this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'error');
                        console.error(`Account ${this.email} failed to collect ${id} - ${name}: ${err}`);
                    }
                },
            };
        });

        createSessionForEachAccount(accounts);

        return { accounts, proxies };
    } catch (error) {
        console.error(error);
    }
};
