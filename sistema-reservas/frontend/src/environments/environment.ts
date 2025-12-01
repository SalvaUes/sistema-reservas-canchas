export const environment = {
  production: true,
  
  // URL del Backend
  apiUrl: 'https://sistema-reservas-canchas-backend.onrender.com/api',
  socketUrl: 'wss://sistema-reservas-canchas-backend.onrender.com/ws',

  // Configuración de Auth0
  auth0: {
    domain: 'dev-ysdsdrcq0muv63t6.us.auth0.com', 
    clientId: 'ZmUvFgNeZgdJut7UFUK1E0tmr88HN0z7',
    
    // Namespace para roles
    namespace: 'https://reservas-api',

    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: 'https://reservas-api/'
    }
  }
};
