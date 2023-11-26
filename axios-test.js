import axios from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';

const instance = axios.create({});

instance.get('https://ifconfig.me').then(response => {
    console.log(response.data);
});
