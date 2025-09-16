// frontend/src/app/login/login.component.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule, HttpClientModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  showPassword = false; // Control de visibilidad de la contraseña

  constructor(private auth: AuthService, private router: Router) {
    // 🔹 Redirige según el rol si ya hay sesión
    if (typeof window !== 'undefined' && this.auth.isLogged()) {
      this.redirectByRole();
    }
  }

  onLogin() {
    this.clearError();

    if (!this.email || !this.password) {
      this.error = 'Por favor completa todos los campos.';
      return;
    }

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.auth.saveToken(res.token);
        this.redirectByRole();
      },
      error: (err) => {
        this.error = err.error?.message || 'Credenciales inválidas';
      }
    });
  }

  // 🔹 Función para redirigir según el rol
  private redirectByRole() {
    const role = this.auth.getUserRole();
    if (role === 'ADMIN') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/cliente']);
    }
  }

  // Alternar visibilidad de contraseña
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // Funciones auxiliares
  private clearError() {
    this.error = '';
  }
}
