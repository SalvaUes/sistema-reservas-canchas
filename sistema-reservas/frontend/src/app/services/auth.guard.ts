import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, UrlTree, RouterStateSnapshot } from '@angular/router'; // 👈 Importar CanActivateChild
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { map, take, filter, switchMap, timeout, catchError } from 'rxjs/operators';
import { AuthService as Auth0Sdk } from '@auth0/auth0-angular';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild { 

  constructor(
    private authService: AuthService, 
    private auth0Sdk: Auth0Sdk, 
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.checkAuth(route);
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.checkAuth(childRoute);
  }

  private checkAuth(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return this.auth0Sdk.isLoading$.pipe(
      filter(loading => !loading), 
      take(1), 
      switchMap(() => this.authService.isAuthenticated$), 
      switchMap(isAuthenticated => {
        if (!isAuthenticated) {
          this.authService.loginWithRedirect();
          return of(false);
        }

        // 2. Obtener Rol
        return this.authService.userRole$.pipe(
          filter(role => role !== null), 
          take(1),
          timeout(3000), 
          catchError(() => of('CLIENTE')), 
          map(userRole => {
            const requiredRoles = route.data['roles'] as string[] | undefined;

            if (userRole === 'ADMIN') return true;

            if (requiredRoles && !requiredRoles.includes(userRole || '')) {
              return this.router.createUrlTree(['/cliente']);
            }

            return true;
          })
        );
      })
    );
  }
}