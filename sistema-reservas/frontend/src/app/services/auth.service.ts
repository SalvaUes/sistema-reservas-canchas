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
  sub: string;   // email o nombre de usuario
  role?: string; // rol del usuario
  id?: number;   // id del usuario si lo incluye el backend
  exp: number;
  iat: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:8080/api/auth';
  private readonly tokenKey = 'auth_token';

  private emailSubject = new BehaviorSubject<string | null>(null);
  private roleSubject = new BehaviorSubject<string | null>(null);
  private idSubject = new BehaviorSubject<number | null>(null);

  /** Observables accesibles globalmente */
  userEmail$ = this.emailSubject.asObservable();
  userRole$ = this.roleSubject.asObservable();
  userId$ = this.idSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromToken();
  }

  // ------------------------
  // 🔐 Autenticación
  // ------------------------
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password });
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  logout(): void {
    this.safeRemoveToken();
    this.emailSubject.next(null);
    this.roleSubject.next(null);
    this.idSubject.next(null);
  }

  isLogged(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp > now; // token no expirado
    } catch {
      return false;
    }
  }

  // ------------------------
  // 🧠 Token helpers
  // ------------------------
  saveToken(token: string): void {
    this.safeSetToken(token);
    this.decodeToken(token);
  }

  getToken(): string | null {
    return this.safeGetToken();
  }

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
  // 🧩 Decodificación
  // ------------------------
  private decodeToken(token: string): void {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      this.emailSubject.next(decoded.sub || null);
      this.roleSubject.next(decoded.role || null);
      this.idSubject.next(decoded.id ?? null);
    } catch {
      this.emailSubject.next(null);
      this.roleSubject.next(null);
      this.idSubject.next(null);
    }
  }

  // ------------------------
  // ⚙️ Métodos síncronos
  // ------------------------
  getUserEmail(): string | null {
    return this.emailSubject.value;
  }

  getUserRole(): string | null {
    return this.roleSubject.value;
  }

  getUserId(): number | null {
    return this.idSubject.value;
  }

  // ------------------------
  // 🔁 Cargar datos al iniciar app
  // ------------------------
  private loadFromToken(): void {
    const token = this.safeGetToken();
    if (token) this.decodeToken(token);
  }
}
