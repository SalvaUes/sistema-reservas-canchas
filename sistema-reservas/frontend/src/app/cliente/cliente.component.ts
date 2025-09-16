// cliente.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-dashboard',

  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './cliente.html',
  styleUrls: ['./cliente.scss']
})
export class ClienteComponent {
  isSidePanelClosed = true;
  manualClose = false;

  user$!: Observable<{ email: string | null; role: string | null }>;

    constructor(private auth: AuthService, private router: Router) {}

    ngOnInit() {
      // Inicializamos los observables de usuario
      this.user$ = combineLatest([this.auth.userEmail$, this.auth.userRole$]).pipe(
        map(([email, role]) => ({ email, role }))
      );

      // 🔹 Recarga solo una vez al entrar a /cliente
      if (!sessionStorage.getItem('clienteReloaded')) {
        sessionStorage.setItem('clienteReloaded', 'true');
        location.reload();
      }
  }

  toggleSidePanel() {
    this.manualClose = !this.manualClose;
    this.isSidePanelClosed = this.manualClose;
  }

  hoverPanel(state: boolean) {
    if (!this.manualClose) {
      this.isSidePanelClosed = !state;
    }
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }
}
