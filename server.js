import 'dotenv/config';
import express from 'express';
import './database.js';
import { setupAppenAccounts } from './config/accounts.js';
import { GET_APPEN_TASK_LIST } from './services/appenTaskList.js';
import cors from 'cors';

import accountsRoutes from './routes/accounts/accounts.js';
import favoritesRoutes from './routes/favorites/favorites.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: 'http://localhost:3000',
    })
);

app.use(express.static('public'));

app.use('/accounts', accountsRoutes);
app.use('/favorites', favoritesRoutes);

app.post('/start', async (req, res) => {
    const { scraping_email, scraping_delay } = req.body;

    if (!scraping_email || !scraping_delay) return res.status(400).send({ error: 'Missing parameters' });
    if (scraping_delay < 500) return res.status(400).send({ error: 'Delay must be greater than 500ms' });

    req.app.locals.scraping_delay = scraping_delay;

    if (!req.app.locals.accounts) {
        req.app.locals.accounts = await setupAppenAccounts(req);
    } else {
        req.app.locals.accounts = req.app.locals.accounts.map(account => {
            account.current_collecting_tasks.forEach(task => task.resume());
            return account;
        });
    }

    const scraping_account = req.app.locals.accounts.find(account => account.email === scraping_email);

    if (!scraping_account) return res.status(400).send({ error: 'Account not found' });
    if (scraping_account.status === 'banned') return res.status(400).send({ error: 'Account is banned' });
    if (scraping_account.status === 'inactive') return res.status(400).send({ error: 'Account is inactive' });

    req.app.locals.scraping_stopped = false;

    setTimeout(async function start_scraping() {
        if (req.app.locals.scraping_stopped) return;

        const task_list = await GET_APPEN_TASK_LIST(scraping_account, req);

        task_list.forEach(task => {
            const id = task[0];
            const name = task[1];
            const level = task[2];
            const payout = task[3];
            const secret = task[12];
            const url = `https://account.appen.com/channels/feca/tasks/${id}?secret=${secret}`;

            const accounts_with_favorite = req.app.locals.accounts.filter(account =>
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
            req.app.locals.scraping_stopped = true;
            return;
        }

        start_scraping();
    }, scraping_delay);

    res.status(200).json({ success: true });
});

app.get('/stop', (req, res) => {
    console.log('Stopping scraping...');
    req.app.locals.scraping_stopped = true;
    req.app.locals.accounts = req.app.locals.accounts.map(account => {
        account.current_collecting_tasks.forEach(task => task.pause());
        return account;
    });

    res.status(200).json({ success: true });
});

app.get('/status', (req, res) => {
    res.status(200).json(req.app.locals.accounts);
});

app.listen(8080, () => {
    console.log('listening on 8080');
});
