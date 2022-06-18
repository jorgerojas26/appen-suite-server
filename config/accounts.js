import Account from '../models/account.js';
import User from '../models/user.js';
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

export const setupAppenAccounts = async userId => {
    try {
        const userAccounts = await User.findOne({ _id: userId }).populate({ path: 'accounts', populate: 'favorites' }).select('accounts');

        let accounts = userAccounts.accounts;

        readOrCreateCookiesFileForEachAccount(accounts);

        accounts = accounts.map(account => {
            return {
                ...account.toObject(),
                current_collecting_tasks: [],
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
                                this.status = 'paused';
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
                    const { name, url } = this.current_collecting_tasks.find(task => task.id === id);

                    try {
                        const { data, config } = await this.axiosInstance.get(url);
                        const response_url = config.url;

                        if (response_url === 'https://account.appen.com/sessions/new') {
                            console.log(`Account ${this.email} is not logged in. Trying to login...`);
                            const login = await appenLoginWithRetry(this);
                            if (!login.error) {
                                setTimeout(() => {
                                    this.collect(id);
                                }, 1000);
                            }
                        } else if (response_url.includes('view.appen.io')) {
                            // TODO: Send task to the browser
                            this.current_collecting_tasks = mutateTaskData(this.current_collecting_tasks, id, 'status', 'in browser');
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

        return accounts;
    } catch (error) {
        console.error(error);
    }
};
