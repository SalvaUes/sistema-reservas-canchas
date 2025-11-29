import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { interval, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ReactivateErrorDialogComponent } from '../../shared/reactivate-error-dialog/reactivate-error-dialog.component';

interface UserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  auth0Id?: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuariosComponent implements OnInit, OnDestroy {

  users: UserDTO[] = [];
  filteredUsers: UserDTO[] = [];
  paginatedUsers: UserDTO[] = [];

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  searchTerm = '';
  showForm = false;
  editingUserId: number | null = null;

  firstName = '';
  lastName = '';
  email = '';
  phoneNumber = '';
  role = 'CLIENTE';
  roles: string[] = ['ADMIN', 'CLIENTE'];

  // Selección optimizada
  selectedUserIds = new Set<number>();
  selectAllPage = false;
  selectAllGlobal = false;

  get selectedCount(): number { return this.selectedUserIds.size; }

  userEmail = '';
  userRole = '';

  private apiUrl = `${environment.apiUrl}/users`;
  private pollingSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.userEmail = this.auth.getUserEmail() || '';
    this.userRole = this.auth.getUserRole() || '';
  }

  ngOnInit() {
    this.loadUsers();

    this.pollingSub = interval(5000).subscribe(() => {
      if (!this.showForm) this.loadUsers(true);
    });
  }

  ngOnDestroy() {
    this.pollingSub?.unsubscribe();
  }

  loadUsers(isPolling = false) {
    this.http.get<UserDTO[]>(this.apiUrl).subscribe({
      next: res => {
        this.users = res;

        if (!isPolling) this.filterUsers();
        else this.applyFilterOnly();
        this.cdr.markForCheck();
      },
      error: () => {
        if (!isPolling) this.showMessage('Error al cargar usuarios.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  applyFilterOnly() {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredUsers.length = 0;
      this.filteredUsers.push(...this.users);
    } else {
      this.filteredUsers = this.users.filter(u => {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        const email = u.email.toLowerCase();
        const role = (u.role || '').toLowerCase();
        const status = (u.status || '').toLowerCase();

        const matchStatus = (term === 'activo' && status === 'active') ||
                            (term === 'inactivo' && status === 'inactive');

        return fullName.includes(term) || email.includes(term) || role.includes(term) || matchStatus;
      });
    }

    this.setupPagination();
  }

  // ---------------- SELECCIÓN OPTIMIZADA ----------------

  onUserSelect(user: UserDTO, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;

    if (checked) this.selectedUserIds.add(user.id);
    else this.selectedUserIds.delete(user.id);

    this.selectAllPage = this.paginatedUsers
      .filter(u => u.email !== this.userEmail)
      .every(u => this.selectedUserIds.has(u.id));
  }

  toggleSelectAllPage(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllPage = checked;

    this.paginatedUsers.forEach(u => {
      if (u.email === this.userEmail) return;

      if (checked) this.selectedUserIds.add(u.id);
      else this.selectedUserIds.delete(u.id);
    });

    if (!checked) this.selectAllGlobal = false;
  }

  toggleSelectAllGlobal(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllGlobal = checked;

    // Optimización: Suspender la detección de cambios mientras procesamos datos masivos
    this.cdr.detach(); 

    this.selectedUserIds.clear();

    if (checked) {
      // Usar un bucle for tradicional es ligeramente más rápido que forEach en arrays gigantes
      for (const u of this.filteredUsers) {
        if (u.email !== this.userEmail) {
          this.selectedUserIds.add(u.id);
        }
      }
    }

    this.setupPagination();
    
    // Reactivar detección y marcar
    this.cdr.reattach();
    this.cdr.markForCheck();
  }

  areAllSelected(): boolean {
    const selectable = this.paginatedUsers.filter(u => u.email !== this.userEmail);
    return selectable.every(u => this.selectedUserIds.has(u.id));
  }

  // ---------------- ACCIONES MASIVAS ----------------

  activateSelectedUsers() {
    const usersToProcess = this.users.filter(u => this.selectedUserIds.has(u.id));
    if (usersToProcess.length > 0)
      this.processBatchStatusChange(usersToProcess, 'ACTIVE', 'Reactivar');
  }

  deactivateSelectedUsers() {
    const usersToProcess = this.users.filter(u =>
      this.selectedUserIds.has(u.id) &&
      u.email !== this.userEmail &&
      u.role !== 'ADMIN'
    );

    if (this.selectedUserIds.size > usersToProcess.length) {
      this.showMessage('Se omitieron administradores o tu usuario.', 'warning');
    }

    if (usersToProcess.length > 0)
      this.processBatchStatusChange(usersToProcess, 'INACTIVE', 'Desactivar');
  }

  private processBatchStatusChange(users: UserDTO[], newStatus: string, actionLabel: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: `${actionLabel} usuarios`,
        message: `¿Desea ${actionLabel.toLowerCase()} a ${users.length} usuario(s)?`
      }
    });

    dialogRef.afterClosed().subscribe(confirm => {
      if (!confirm) return;

      const tasks = users.map(user => {
        const payload = {
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          roleName: user.role,
          status: newStatus
        };

        return this.http.put<UserDTO>(`${this.apiUrl}/${user.id}`, payload).pipe(
          map(() => ({ code: user.email, message: `${actionLabel} exitoso`, status: 'success' as const })),
          catchError(err => {
            const errorMsg = typeof err.error === 'string'
              ? err.error
              : (err.error?.message || 'Error desconocido');

            return of({ code: user.email, message: errorMsg, status: 'failed' as const });
          })
        );
      });

      forkJoin(tasks).subscribe(results => {
        this.loadUsers(true);
        this.selectedUserIds.clear();
        this.selectAllPage = false;
        this.selectAllGlobal = false;

        this.dialog.open(ReactivateErrorDialogComponent, {
          width: '500px',
          data: results
        });
      });
    });
  }

  deactivateUser(user: UserDTO) {
    if (user.email === this.userEmail)
      return this.showMessage('No puedes desactivar tu propio usuario.', 'warning');

    if (user.role === 'ADMIN')
      return this.showMessage('No se puede desactivar a un Administrador.', 'warning');

    this.processBatchStatusChange([user], 'INACTIVE', 'Desactivar');
  }

  activateUser(user: UserDTO) {
    this.processBatchStatusChange([user], 'ACTIVE', 'Reactivar');
  }

  // ---------------- FILTROS, FORM Y UI ----------------

  hoverPanel(isHovering: boolean) { }
  logout() { this.auth.logout(); }
  showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }

  filterUsers() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredUsers = [...this.users];
      this.setupPagination();
      return;
    }

    this.filteredUsers = this.users.filter(u => {
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      const email = u.email.toLowerCase();
      const role = (u.role || '').toLowerCase();
      const status = (u.status || '').toLowerCase();

      const matchStatus = (term === 'activo' && status === 'active') ||
                          (term === 'inactivo' && status === 'inactive');

      return fullName.includes(term) || email.includes(term) || role.includes(term) || matchStatus;
    });

    this.setupPagination();
  }

  setupPagination() {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);

    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, start + this.itemsPerPage);

    const selectable = this.paginatedUsers.filter(u => u.email !== this.userEmail);
    this.selectAllPage = selectable.length > 0 && selectable.every(u => this.selectedUserIds.has(u.id));
  }

  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.setupPagination(); } }
  previousPage() { if (this.currentPage > 1) { this.currentPage--; this.setupPagination(); } }

  openForm(user: UserDTO) {
    this.showForm = true;
    this.editingUserId = user.id;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.email = user.email;
    this.phoneNumber = user.phoneNumber || '';
    this.role = user.role || 'CLIENTE';
  }

  cancelForm() {
    this.showForm = false;
    this.editingUserId = null;
    this.resetForm();
  }

  resetForm() {
    this.firstName = '';
    this.lastName = '';
    this.email = '';
    this.phoneNumber = '';
    this.role = 'CLIENTE';
  }

  submitForm() {
    if (!this.firstName || !this.lastName) {
      return this.showMessage('Por favor complete todos los campos obligatorios.', 'warning');
    }

    if (!this.editingUserId) return;

    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      roleName: this.role
    };

    this.http.put<UserDTO>(`${this.apiUrl}/${this.editingUserId}`, payload).subscribe({
      next: updated => {
        const index = this.users.findIndex(u => u.id === this.editingUserId);
        if (index !== -1) this.users[index] = updated;

        this.filterUsers();
        this.cancelForm();
        this.showMessage('Usuario actualizado correctamente.', 'success');
      },
      error: err => {
        const msg = typeof err.error === 'string' ? err.error : (err.error?.message || 'Error al actualizar usuario.');
        this.showMessage(msg, 'error');
      }
    });
  }

  trackById(index: number, item: UserDTO): number {
    return item.id;
  }
}
