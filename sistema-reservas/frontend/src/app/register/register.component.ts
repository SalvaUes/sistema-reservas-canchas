// register.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  providers: [AuthService],
  imports: [FormsModule, CommonModule, HttpClientModule],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  phoneNumber = '';
  dateOfBirth = '';
  message = '';
  showPassword = false;
  today: string = new Date().toISOString().split('T')[0];

  constructor(
    private router: Router,
    private auth: AuthService
  ) {
    // Redirigir si ya está logueado
    if (typeof window !== 'undefined' && this.auth.isLogged()) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // 🔹 Permitir solo números
  allowOnlyNumbers(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }

  // 🔹 Validar email con regex
  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  onRegister() {
    this.clearMessage();
    this.trimInputs();

    // Validar campos obligatorios
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      return this.setMessage('Por favor completa todos los campos obligatorios.', 'error');
    }

    // 🔹 Confirmar que el correo contenga un "@"
    if (!this.isValidEmail(this.email)) {
      return this.setMessage('Ingresa un correo electrónico válido que contenga "@"', 'error');
    }

    // Validar teléfono
    if (this.phoneNumber && !/^\d+$/.test(this.phoneNumber)) {
      return this.setMessage('El teléfono solo puede contener números.', 'error');
    }

    // Validar fecha de nacimiento
    if (this.dateOfBirth && this.dateOfBirth > this.today) {
      return this.setMessage('La fecha de nacimiento no puede ser futura.', 'error');
    }

    const newUser = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      phoneNumber: this.phoneNumber,
      dateOfBirth: this.dateOfBirth
    };

    this.auth.register(newUser).subscribe({
      next: () => {
        this.setMessage('Registro exitoso. Ahora puedes iniciar sesión.', 'success');
        this.resetFields();
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.setMessage('Error al registrar: ' + (err.error?.message || 'Intenta de nuevo'), 'error');
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  // 🔹 Recortar entradas según reglas
  private trimInputs() {
    this.firstName = this.firstName.trim().slice(0, 50);
    this.lastName = this.lastName.trim().slice(0, 50);
    this.email = this.email.trim().slice(0, 100);
    this.password = this.password.slice(0, 20);
    this.phoneNumber = this.phoneNumber?.slice(0, 15) || '';
  }

  private resetFields() {
    this.firstName = '';
    this.lastName = '';
    this.email = '';
    this.password = '';
    this.phoneNumber = '';
    this.dateOfBirth = '';
  }

  private setMessage(msg: string, type: 'success' | 'error') {
    this.message = msg;
    const el = document.querySelector('.message');
    if (el) {
      el.classList.remove('success', 'error');
      el.classList.add(type);
    }
  }

  private clearMessage() {
    this.message = '';
    const el = document.querySelector('.message');
    if (el) {
      el.classList.remove('success', 'error');
    }
  }
}
