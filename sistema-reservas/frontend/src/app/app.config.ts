import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

import { authInterceptor } from './services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(routes, withHashLocation()),

    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.authorizationParams.audience,
        scope: 'openid profile email offline_access read:reservations create:reservations update:reservations delete:reservations read:courts read:payments create:payments'
      },
      cacheLocation: 'localstorage',
      httpInterceptor: {
        allowedList: [`${environment.apiUrl}/*`]
      }
    }),

    provideHttpClient(
      withFetch(),
      withInterceptors([
        authHttpInterceptorFn, 
        authInterceptor        
      ])
    ),

    provideNativeDateAdapter(),
    provideAnimations(),
  ]
};