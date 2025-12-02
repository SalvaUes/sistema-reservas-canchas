import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; 
import { NotificationComponent } from "./shared/notificaciones/notificaciones.component";
import { ReservationPendingService } from './services/reservation/reservation-pending.service';
import { ReservationReactivatedService } from './services/reservation/reservation-reactivated.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule, 
    NotificationComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  
  private readonly reservationPendingService = inject(ReservationPendingService);
  private readonly reservationReactivatedService = inject(ReservationReactivatedService);
  private readonly auth = inject(AuthService);

  showBlockModal = false;
  blockMessage = '';
  
  // 🆕 Variables para controlar el estilo del modal
  modalType: 'blocked' | 'role_change' = 'blocked'; 
  modalTitle = '';
  modalIcon = '';

  ngOnInit() {
    this.auth.authError$.subscribe(error => {
      if (error) {
        this.blockMessage = error;
        this.determineModalStyle(error);
        this.showBlockModal = true;
      }
    });
  }

  // 🆕 Lógica para diferenciar
  private determineModalStyle(message: string) {
    const msgLower = message.toLowerCase();

    if (msgLower.includes('rol') || msgLower.includes('permisos') || msgLower.includes('role')) {
      // CASO: Cambio de Rol (Azul/Amigable)
      this.modalType = 'role_change';
      this.modalTitle = 'Actualización Requerida';
      this.modalIcon = '🔄'; 
    } else {
      // CASO: Bloqueo (Rojo/Alerta)
      this.modalType = 'blocked';
      this.modalTitle = '¡Acceso Revocado!';
      this.modalIcon = '🚫';
    }
  }

  closeBlockModal() {
    this.showBlockModal = false;
    this.auth.logout();
  }
}