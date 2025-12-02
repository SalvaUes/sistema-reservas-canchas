import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      
      if (error.status === 403 || error.status === 401) {
        
        const errorMsg = JSON.stringify(error.error || '').toLowerCase();
        
        if (errorMsg.includes('desactivada') || errorMsg.includes('inactive')) {
          authService.notifyUserBlocked("Su cuenta ha sido desactivada por un administrador.");
        } 
        else if (errorMsg.includes('rol ha cambiado') || errorMsg.includes('role changed')) {
          authService.notifyUserBlocked("Sus permisos han cambiado. Debe iniciar sesión nuevamente para actualizar su perfil.");
        }
      }

      return throwError(() => error);
    })
  );
};