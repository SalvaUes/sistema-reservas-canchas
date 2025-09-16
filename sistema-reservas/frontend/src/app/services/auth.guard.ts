import { Injectable } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (typeof window === 'undefined') return false;

    const isLogged = this.auth.isLogged();
    const userRole = this.auth.getUserRole();
    const url = state.url.replace('#', '');

    // Bloquear rutas privadas si no está logueado
    if (!isLogged && !['/login', '/register'].includes(url)) {
      return this.router.parseUrl('/login');
    }

    // Si ya está logueado, redirigir fuera de login/register
    if (isLogged && ['/login', '/register'].includes(url)) {
      return this.router.parseUrl('/admin');
    }

    // Si es ADMIN, acceso total
    if (userRole === 'ADMIN') return true;

    // Validar roles definidos en la ruta
    const routeRoles = route.data['roles'] as string[] | undefined;
    if (routeRoles && !routeRoles.includes(userRole || '')) {
      return this.router.parseUrl('/login');
    }


    return true;
  }
}
