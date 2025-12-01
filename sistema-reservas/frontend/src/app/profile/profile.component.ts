import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../shared/notificaciones/notification.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface UserProfileDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  
  user: UserProfileDTO | null = null;
  isLoading = true;
  isSaving = false;

  firstName = '';
  lastName = '';
  phoneNumber = '';
  email = '';

  private apiUrl = `${environment.apiUrl}/users`;

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Esperar a que Auth0 tenga token antes de cargar usuario
    this.auth.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.loadUserProfile();
      } else {
        this.isLoading = false;
      }
    });
  }

  logout() {
    this.auth.logout({ returnTo: window.location.origin });
  }

  private loadUserProfile() {
    this.isLoading = true;

    // Obtener email del usuario desde Auth0
    this.auth.user$.subscribe(profile => {
      if (!profile?.email) {
        this.notify.show('No se pudo identificar al usuario.', 'error');
        this.isLoading = false;
        return;
      }

      const currentEmail = profile.email;

      // Llamada al backend con Auth0 HTTP interceptor (envía token automáticamente)
      this.http.get<UserProfileDTO[]>(this.apiUrl).subscribe({
        next: users => {
          const found = users.find(u => u.email === currentEmail);
          if (found) {
            this.user = found;
            this.populateForm(found);
          } else {
            this.notify.show('Usuario no encontrado.', 'error');
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Error backend:', err);
          this.notify.show('Error al cargar perfil.', 'error');
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
    });
  }

  private populateForm(user: UserProfileDTO) {
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phoneNumber = user.phoneNumber || '';
  }

  saveProfile() {
    if (!this.user) return;
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.notify.show('Nombre y Apellido son obligatorios.', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      roleName: this.user.role
    };

    this.http.put(`${this.apiUrl}/${this.user.id}`, payload).subscribe({
      next: () => {
        this.notify.show('Perfil actualizado correctamente.', 'success');
        this.isSaving = false;
        if (this.user) {
          this.user.firstName = payload.firstName;
          this.user.lastName = payload.lastName;
          this.user.phoneNumber = payload.phoneNumber;
        }
        this.cdr.markForCheck();
      },
      error: err => {
        const msg = err.error?.message || 'Error al guardar cambios.';
        this.notify.show(msg, 'error');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
