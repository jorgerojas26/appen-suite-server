import Proxy from '../models/proxy.js';

const GET_PROXIES = async (req, res) => {
    const userId = req.auth.user.id;

    try {
        const proxies = await Proxy.find({ userId });
        res.status(200).json(proxies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const CREATE_PROXY = async (req, res) => {
    const userId = req.auth.user.id;
    const { type, host, port } = req.body;

    try {
        const proxy = new Proxy({ userId, type, host, port });
        await proxy.save();

        res.status(201).json(proxy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const CREATE_PROXY_BULK = async (req, res) => {
    const userId = req.auth.user.id;
    const { proxies } = req.body;

    let errors = [];

    for (let proxy of proxies) {
        if (!proxy.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/)) {
            errors.push(`${proxy} doesn't match the format ip:port`);
        }
    }

    if (errors.length) return res.status(400).json({ error: errors });

    try {
        const createdProxies = [];

        for (let proxy of proxies) {
            const host = proxy.split(':')[0];
            const port = proxy.split(':')[1];

            const proxyExists = await Proxy.findOne({ userId, type: 'http', host, port });

            if (!proxyExists) {
                const newProxy = await new Proxy({ userId, type: 'http', host, port });
                await newProxy.save();
                createdProxies.push(newProxy);
            }
        }

        res.status(201).json(createdProxies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const UPDATE_PROXY = async (req, res) => {
    const userId = req.auth.user.id;
    const { id, type, host, port } = req.body;

    try {
        const proxy = await Proxy.findOneAndUpdate({ _id: id, userId }, { type, host, port }, { new: true });
        res.status(200).json(proxy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const DELETE_PROXY = async (req, res) => {
    const userId = req.auth.user.id;
    const { id } = req.params;

    try {
        const proxy = await Proxy.findOne({ _id: id, userId });

        if (!proxy) return res.status(404).json({ error: 'Proxy not found' });

        await proxy.delete();
        res.status(200).json({ message: 'Proxy deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default {
    GET_PROXIES,
    CREATE_PROXY,
    CREATE_PROXY_BULK,
    UPDATE_PROXY,
    DELETE_PROXY,
};
