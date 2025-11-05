// frontend/src/app/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = '';
  showPassword = false;
  isLoading = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Redirige según el rol si ya hay sesión activa
    if (typeof window !== 'undefined' && this.auth.isLogged()) {
      this.redirectByRole();
    }
  }

  onLogin(): void {
    this.clearError();

    if (!this.email || !this.password) {
      this.error = 'Por favor completa todos los campos.';
      return;
    }

    this.isLoading = true;

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.auth.saveToken(res.token);
        this.redirectByRole();
      },
      error: (err) => {
        this.isLoading = false;

        let message = 'Error en el inicio de sesión';

        // Manejar errores 401 de Spring Boot
        if (err.status === 401 && err.error) {
          if (typeof err.error === 'string') {
            // A veces err.error puede ser un string
            message = err.error;
          } else if ('message' in err.error) {
            message = err.error.message;
          }
        } else if (err.error && typeof err.error === 'string') {
          message = err.error;
        }

        this.error = message;
      }
    });
  }

  private redirectByRole(): void {
    const role = this.auth.getUserRole();
    if (role === 'ADMIN') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/cliente']);
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  private clearError(): void {
    this.error = '';
  }
}
