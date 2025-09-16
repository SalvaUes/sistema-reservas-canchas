// frontend/src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

interface LoginResponse {
  token: string;
  role?: string;
}

interface JwtPayload {
  sub: string;
  role?: string;
  exp: number;
  iat: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private tokenKey = 'auth_token';

  // Observables para componentes
  private emailSubject = new BehaviorSubject<string | null>(null);
  private roleSubject = new BehaviorSubject<string | null>(null);

  userEmail$ = this.emailSubject.asObservable();
  userRole$ = this.roleSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromToken();
  }

  // ------------------------
  // Login y registro
  // ------------------------
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password });
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  // ------------------------
  // Manejo seguro de localStorage
  // ------------------------
  private safeGetToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.tokenKey);
  }

  private safeSetToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.tokenKey, token);
  }

  private safeRemoveToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.tokenKey);
  }

  // ------------------------
  // Guardar token y actualizar observables
  // ------------------------
  saveToken(token: string): void {
    this.safeSetToken(token);
    this.decodeToken(token);
  }

  getToken(): string | null {
    return this.safeGetToken();
  }

  logout(): void {
    this.safeRemoveToken();
    this.emailSubject.next(null);
    this.roleSubject.next(null);
  }

  isLogged(): boolean {
    return !!this.getToken();
  }

  // ------------------------
  // Métodos síncronos para guardas
  // ------------------------
  getUserEmail(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.sub || null;
    } catch {
      return null;
    }
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.role || null;
    } catch {
      return null;
    }
  }

  getUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded = jwtDecode<any>(token);
      return decoded.id ?? null;
    } catch {
      return null;
    }
  }

  // ------------------------
  // Inicializar observables desde token
  // ------------------------
  private loadFromToken() {
    const token = this.safeGetToken();
    if (token) this.decodeToken(token);
  }

  private decodeToken(token: string) {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      this.emailSubject.next(decoded.sub || null);
      this.roleSubject.next(decoded.role || null);
    } catch {
      this.emailSubject.next(null);
      this.roleSubject.next(null);
    }
  }
}
