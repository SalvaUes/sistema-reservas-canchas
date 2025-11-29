export const environment = {
  production: false,
  
  // URL del Backend
  apiUrl: 'http://localhost:8080/api',
  socketUrl: 'ws://localhost:8080/ws',

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