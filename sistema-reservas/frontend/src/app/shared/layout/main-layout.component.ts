import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  
  isSidePanelClosed = false;
  userEmail = '';
  userRole = '';

  constructor(
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.userEmail = this.auth.getUserEmail() || '';
    this.userRole = this.auth.getUserRole() || '';
  }

  // 💡 ESTO ES NUEVO: Getter para definir la clase CSS dinámica
  get themeClass(): string {
    return this.userRole === 'ADMIN' ? 'admin-theme' : 'client-theme';
  }

  toggleSidePanel() {
    this.isSidePanelClosed = !this.isSidePanelClosed;
    this.cdr.markForCheck();
  }

  hoverPanel(isHovering: boolean) {
    // Lógica opcional de hover
  }

  logout() {
    this.auth.logout();
  }
}