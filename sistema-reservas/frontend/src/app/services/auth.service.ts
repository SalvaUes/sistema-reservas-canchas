import { Injectable, Inject } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular'; 
import { BehaviorSubject, Observable, of } from 'rxjs';
import { filter, switchMap, tap, catchError, take } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private roleSubject = new BehaviorSubject<string | null>(null);
  private emailSubject = new BehaviorSubject<string | null>(null);
  private errorSubject = new BehaviorSubject<string | null>(null);

  userRole$ = this.roleSubject.asObservable();
  userEmail$ = this.emailSubject.asObservable();
  authError$ = this.errorSubject.asObservable();
  
  isAuthenticated$: Observable<boolean>;

  constructor(
    private auth0: Auth0Service,
    private http: HttpClient,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.isAuthenticated$ = this.auth0.isAuthenticated$;

    this.auth0.isAuthenticated$.pipe(
      filter(isAuth => isAuth), 
      switchMap(() => this.syncWithBackend())
    ).subscribe();
  }

  notifyUserBlocked(message: string) {
    this.errorSubject.next(message);
  }

  private syncWithBackend(): Observable<any> {
    this.errorSubject.next(null);

    return this.http.post<any>(`${environment.apiUrl}/auth/login`, {}).pipe(
      tap(backendUser => {
        if (backendUser) {
          this.emailSubject.next(backendUser.email);
          this.roleSubject.next(backendUser.role); 
        }
      }),
      catchError((err: HttpErrorResponse) => {
        const errorMsg = err.error?.message || err.error?.error || JSON.stringify(err.error) || err.message;

        if (errorMsg && (errorMsg.includes('inactiva') || errorMsg.includes('Contacte al administrador'))) {
            this.notifyUserBlocked("Su cuenta está inactiva. Contacte al administrador.");
            return of(null);
        }

        this.fallbackToToken();
        return of(null);
      })
    );
  }

  private fallbackToToken() {
    this.auth0.user$.pipe(take(1)).subscribe((user: any) => {
      if (user) {
        const rolesClaim = `${environment.auth0.namespace}/roles`;
        
        const roles = user[rolesClaim] || [];
        const role = roles.includes('ADMIN') ? 'ADMIN' : 'CLIENTE';
        
        this.roleSubject.next(role);
        this.emailSubject.next(user.email || '');
      }
    });
  }

  loginWithRedirect() {
    this.auth0.loginWithRedirect();
  }

  register() { 
    this.auth0.loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } });
  }

  logout() {
    this.roleSubject.next(null);
    this.emailSubject.next(null);
    this.errorSubject.next(null);
    this.auth0.logout({ 
      logoutParams: { returnTo: this.doc.location.origin } 
    });
  }

  getUserRole() { return this.roleSubject.value; }
  getUserEmail() { return this.emailSubject.value; }
  getAccessToken() { return this.auth0.getAccessTokenSilently(); }
}