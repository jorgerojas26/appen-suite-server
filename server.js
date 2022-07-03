import 'dotenv/config';
import express from 'express';
import './database.js';
import { setupAppenAccounts } from './config/accounts.js';
import { GET_APPEN_TASK_LIST } from './services/appenTaskList.js';
import cors from 'cors';

import accountsRoutes from './routes/accounts/accounts.js';
import favoritesRoutes from './routes/favorites/favorites.js';
import authRoutes from './routes/auth/auth.js';
import proxyRoutes from './routes/proxies/proxies.js';

import { expressjwt as jwt } from 'express-jwt';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: '*',
    })
);

app.use(express.static('public'));

app.use(jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] }).unless({ path: ['/auth/login'] }));
app.use('/auth', authRoutes);

app.use('/accounts', accountsRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/proxies', proxyRoutes);

app.post('/start', async (req, res) => {
    const { scraping_email, scraping_delay } = req.body;

    const userId = req.auth.user.id;

    if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId]) {
        const scraping_stopped = req.app.locals.accounts_info[userId].scraping_stopped;

        if (scraping_stopped === null || scraping_stopped === undefined || scraping_stopped === false) {
            return res.status(200).json({ success: true });
        }
    }

    if (!scraping_email || !scraping_delay) return res.status(400).send({ error: 'Missing parameters' });
    if (scraping_delay < 500) return res.status(400).send({ error: 'Delay must be greater than 500ms' });

    if (!req.app.locals.accounts_info) {
        req.app.locals.accounts_info = {};
    }

    req.app.locals.accounts_info[userId] = {
        scraping_email,
        scraping_delay,
        task_list: req.app.locals.accounts_info[userId]?.task_list ?? [],
        current_busy_proxies: req.app.locals.accounts_info[userId]?.current_busy_proxies ?? [],
        proxies: req.app.locals.accounts_info[userId]?.proxies ?? [],
        current_collecting_tasks: req.app.locals.accounts_info[userId]?.current_collecting_tasks ?? {},
        accounts: req.app.locals.accounts_info[userId]?.accounts ?? [],
    };

    if (req.app.locals.accounts_info[userId].scraping_stopped === false) {
        return res.status(200).json({ success: true });
    }

    if (!req.app.locals.accounts_info[userId].accounts.length) {
        console.log('Setting up accounts');
        const { accounts, proxies } = await setupAppenAccounts(req);
        req.app.locals.accounts_info[userId].accounts = accounts;
        req.app.locals.accounts_info[userId].proxies = proxies;
    } else {
        req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
            account.current_collecting_tasks.forEach(task => {
                console.log(task.status);
                if (task.status === 'paused') {
                    task.resume();
                }
            });
            return account;
        });
    }

    const scraping_account = req.app.locals.accounts_info[userId].accounts.find(account => account.email === scraping_email);

    if (!scraping_account) return res.status(400).send({ error: 'Account not found' });
    if (scraping_account.status === 'banned') return res.status(400).send({ error: 'Account is banned' });
    if (scraping_account.status === 'inactive') return res.status(400).send({ error: 'Account is inactive' });

    req.app.locals.accounts_info[userId].scraping_stopped = false;

    setTimeout(async function start_scraping() {
        if (req.app.locals.accounts_info[userId].scraping_stopped) return;

        const task_list = await GET_APPEN_TASK_LIST(scraping_account, req, userId);

        req.app.locals.accounts_info[userId].task_list = task_list.map(task => {
            const id = task[0];
            const name = task[1];
            const numberOfTasks = task[4];
            const level = task[2];
            const payout = task[3];
            const secret = task[12];
            const rating = task[7];
            const url = `https://account.appen.com/channels/feca/tasks/${id}?secret=${secret}`;

            return {
                id,
                jobTitle: name,
                url,
                level,
                pay: payout,
                numOfTasks: numberOfTasks,
                rating,
            };
        });

        task_list.forEach(task => {
            const id = task[0];
            const name = task[1];
            const level = task[2];
            const payout = task[3];
            const secret = task[12];
            const url = `https://account.appen.com/channels/feca/tasks/${id}?secret=${secret}`;

            const accounts_with_favorite = req.app.locals.accounts_info[userId].accounts.filter(account =>
                //TODO: change favorite.active condition
                account.favorites.find(favorite => name.toLowerCase().includes(favorite.name.toLowerCase()) && favorite.active === false)
            );

            accounts_with_favorite.forEach(account => {
                const taskExists = account.current_collecting_tasks.find(task => task.id === id);

                if (!taskExists || taskExists.status === 'expired') {
                    account.start_collecting({ id, name, level, payout, url });
                }
            });
        });

        console.log(`Found ${task_list.length} tasks for ${scraping_account.email}`);

        if (scraping_account.status === 'inactive' || scraping_account.status === 'banned') {
            console.log(`Account ${scraping_account.email} is inactive, stopping...`);
            req.app.locals.accounts_info[userId].scraping_stopped = true;
            return;
        }

        start_scraping();
    }, scraping_delay);

    res.status(200).json({ success: true });
});

app.get('/stop', (req, res) => {
    const userId = req.auth.user.id;

    console.log('Stopping scraping...');

    if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId]) {
        req.app.locals.accounts_info[userId].scraping_stopped = true;
        req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
            account.current_collecting_tasks.forEach(task => task.pause());
            return account;
        });

        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ error: 'No scraping is running' });
    }
});

app.get('/status', (req, res) => {
    const userId = req.auth.user.id;

    if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId]) {
        req.app.locals.accounts_info[userId].accounts.forEach(account => {
            account.current_collecting_tasks.forEach(task => {
                if (!req.app.locals.accounts_info[userId].current_collecting_tasks[task.id]) {
                    req.app.locals.accounts_info[userId].current_collecting_tasks[task.id] = {
                        title: task.name,
                        pay: task.payout,
                        level: task.level,
                        accounts: [],
                    };
                } else {
                    const already_exists = req.app.locals.accounts_info[userId].current_collecting_tasks[task.id].accounts.find(
                        acc => acc.email === account.email
                    );

                    if (!already_exists) {
                        req.app.locals.accounts_info[userId].current_collecting_tasks[task.id].accounts.push({
                            account_id: account._id,
                            email: account.email,
                            account_status: account.status,
                            fetch_count: task.fetch_count,
                            task_status: task.status,
                            pay: task.payout,
                            level: task.level,
                        });
                    } else {
                        req.app.locals.accounts_info[userId].current_collecting_tasks[task.id].accounts = req.app.locals.accounts_info[
                            userId
                        ].current_collecting_tasks[task.id].accounts.map(acc => {
                            if (acc.email === account.email) {
                                return {
                                    account_id: account._id,
                                    email: account.email,
                                    fetch_count: task.fetch_count,
                                    account_status: account.status,
                                    task_status: task.status,
                                    pay: task.payout,
                                    level: task.level,
                                };
                            }
                            return task;
                        });
                    }
                }
            });
        });

        res.status(200).json(req.app.locals.accounts_info[userId]);
    } else {
        res.status(400).json({ error: 'No scraping is running' });
    }
});

app.listen(8080, () => {
    console.log('listening on 8080');
});
