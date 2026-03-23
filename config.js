
const DEV_CONFIG = {
  API_URL: 'http://192.168.1.66:5000/api',
};

const PROD_CONFIG = {
  API_URL: 'https://tifficaapp-1.onrender.com/api',
};


const USE_PRODUCTION = false;

const CONFIG = USE_PRODUCTION ? PROD_CONFIG : DEV_CONFIG;


export const API_URL = CONFIG.API_URL;

export default CONFIG;


console.log('📱 TIFFICA App Configuration:');
console.log(`🌍 Environment: ${USE_PRODUCTION ? 'PRODUCTION (Render)' : 'DEVELOPMENT (Local)'}`);
console.log(`🔗 API_URL: ${CONFIG.API_URL}`);
