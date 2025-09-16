import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss']
})
export class AdminComponent implements OnInit {
  isSidePanelClosed = true;
  manualClose = false;

  user$!: Observable<{ email: string | null; role: string | null }>;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    // Inicializamos los observables de usuario
    this.user$ = combineLatest([this.auth.userEmail$, this.auth.userRole$]).pipe(
      map(([email, role]) => ({ email, role }))
    );

    // 🔹 Recarga solo una vez al entrar a /admin
    if (!sessionStorage.getItem('adminReloaded')) {
      sessionStorage.setItem('adminReloaded', 'true');
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
    sessionStorage.removeItem('adminReloaded'); // limpiar bandera
    this.router.navigate(['/login']);
  }
}
