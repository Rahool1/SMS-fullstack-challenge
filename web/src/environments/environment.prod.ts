const PROTOCOL = 'http';
const HOST = window.location.hostname;
const PORT = 3001;
export const environment = Object.assign({
  production: false
}, {
  apiUrl: `${PROTOCOL}://${HOST}:${PORT}/`
});
