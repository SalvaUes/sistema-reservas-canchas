// main.ts
import 'zone.js'; // <-- obligatorio para Angular (NG0908)
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router'; // Ruteo con HashLocationStrategy
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';

import { App } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withHashLocation()), // Ruteo con HashLocationStrategy
    provideHttpClient(withFetch()),
    provideNativeDateAdapter() // Proveedor para el adaptador de fecha nativo
  ]
}).catch(err => console.error(err));
