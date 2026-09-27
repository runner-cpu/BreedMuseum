export const ROUTES = Object.freeze({
 music: 'https://app-dr6mrcqei51d-api-Q9KWzK5EmKn9-gateway.appmiaoda.com/v1/music_generation',
 lyrics: 'https://app-dr6mrcqei51d-api-GaDwzeNAKeAY-gateway.appmiaoda.com/v1/lyrics_generation',
});
export function gatewayRequest(action, key, body, signal) {
 if (!Object.hasOwn(ROUTES, action)) throw Error('Invalid action');
 if (typeof key !== 'string' || !key.trim()) throw Error('Missing server configuration: INTEGRATIONS_API_KEY');
 return [ROUTES[action], {method:'POST', headers:{
  'X-Gateway-Authorization':'Bearer '+key, 'Content-Type':'application/json'
 }, body:JSON.stringify(body), signal}];
}
