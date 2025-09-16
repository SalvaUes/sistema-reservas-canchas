// main.ts
import 'zone.js'; // <-- obligatorio para Angular (NG0908)
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router'; // 👈 importa withHashLocation
import { provideHttpClient, withFetch } from '@angular/common/http';

import { App } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withHashLocation()), // 👈 agrega withHashLocation()
    provideHttpClient(withFetch())
  ]
}).catch(err => console.error(err));
