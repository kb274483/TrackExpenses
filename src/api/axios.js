import Axios from 'axios';

const API_BASE_URL = 'https://brief-url.link/url_api';
const DEV_API_BASE_URL = 'http://localhost:8080/url_api';

const api = Axios.create({
  baseURL: process.env.DEV ? DEV_API_BASE_URL : API_BASE_URL,
});

// api.interceptors.request.use(
//   config => {
//     const token = store.state.module.jwtToken;
//     if (token) {
//       config.headers['Authorization'] = `Bearer ${token}`;
//     }
//     return config;
//   },
//   error => {
//     return Promise.reject(error);
//   }
// );

export default api;
