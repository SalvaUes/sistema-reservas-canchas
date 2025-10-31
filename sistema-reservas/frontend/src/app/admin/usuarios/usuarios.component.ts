import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';


interface UserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  roles: { name: string }[];
  status?: string; // ACTIVE o INACTIVE
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss'],
})
export class UsuariosComponent implements OnInit {
  users: UserDTO[] = [];
  filteredUsers: UserDTO[] = [];
  paginatedUsers: UserDTO[] = [];

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  searchTerm = '';
  showForm = false;
  editMode = false;
  editingUserId: number | null = null;
  showPassword = false;

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  phoneNumber = '';
  role = '';
  roles: string[] = [];

  selectedUsers: UserDTO[] = [];
  selectAllChecked = false;

  selectAllPage = false;    // Checkbox de la página actual
  selectAllGlobal = false;  // Checkbox de todos los registros

  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

  private apiUrl = 'http://localhost:8080/api/users';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private dialog: MatDialog
  ) {
    this.userEmail = this.auth.getUserEmail() || 'admin@correo.com';
    this.userRole = this.auth.getUserRole() || 'ROL_NO_DEFINIDO';
  }

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
  }

  toggleSidePanel() {
    this.isSidePanelClosed = !this.isSidePanelClosed;
  }

  hoverPanel(isHovering: boolean) {
    if (this.isSidePanelClosed) this.isSidePanelClosed = !isHovering ? true : false;
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }

  // Cargar usuarios
  loadUsers() {
    this.http.get<UserDTO[]>(this.apiUrl).subscribe({
      next: res => {
        this.users = res;
        this.filterUsers();
      },
      error: () => this.showMessage('Error al cargar usuarios.', 'error')
    });
  }

  // Cargar roles
  loadRoles() {
    this.http.get<{ name: string }[]>('http://localhost:8080/api/roles').subscribe({
      next: res => {
        // Excluir el rol 'USER' solo para creación
        this.roles = res.map(r => r.name).filter(r => r !== 'USER');

        // Asignar rol por defecto si no hay seleccionado
        if (!this.role && this.roles.length > 0) this.role = this.roles[0];
      },
      error: () => this.showMessage('Error al cargar roles.', 'error')
    });
  }

  get selectedCount(): number {
    return this.selectedUsers.length;
  }


  // Seleccionar/deseleccionar todos en la página visible
  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllChecked = checked;

    this.paginatedUsers.forEach(user => {
      if (user.email === this.userEmail) return; // nunca seleccionar al usuario logeado
      if (checked && !this.selectedUsers.includes(user)) {
        this.selectedUsers.push(user);
      }
      if (!checked) {
        this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
      }
    });
  }

  toggleSelectAllGlobal(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllGlobal = checked;

    if (checked) {
      this.selectedUsers = this.users.filter(u => u.email !== this.userEmail);
      this.selectAllPage = true; // marcar checkbox de página también
      this.showMessage('Estás seleccionando todos los registros.', 'warning');
    } else {
      this.selectedUsers = [];
      this.selectAllPage = false;
    }
  }

  toggleSelectAllPage(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllPage = checked;

    // Si es solo selección por página, desactivamos global
    if (!this.selectAllGlobal) {
      this.paginatedUsers.forEach(user => {
        if (user.email === this.userEmail) return;

        if (checked && !this.selectedUsers.includes(user)) {
          this.selectedUsers.push(user);
        }
        if (!checked) {
          this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
        }
      });
    }
  }

  // Selección individual
  toggleSelection(user: UserDTO, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      if (user.email === this.userEmail) return;
      this.selectedUsers.push(user);
    } else {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
      this.selectAllGlobal = false; // desactivar selección global si se deselecciona alguno
    }

    // Actualizar checkbox de la página actual
    this.selectAllPage = this.paginatedUsers.every(
      u => u.email === this.userEmail || this.selectedUsers.includes(u)
    );
  }

  // Activar usuarios seleccionados
  activateSelectedUsers() {
    if (this.selectedUsers.length === 0) {
      this.showMessage('No hay usuarios seleccionados.', 'warning');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Reactivar usuarios',
        message: `¿Desea reactivar a ${this.selectedUsers.length} usuario(s)?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const headers = new HttpHeaders({ userRole: this.userRole });
      this.selectedUsers.forEach(user => {
        this.http.put(`${this.apiUrl}/${user.id}/activate`, {}, { headers }).subscribe({
          next: () => {
            user.status = 'ACTIVE';
            this.filterUsers();
          },
          error: () => this.showMessage(`Error al reactivar "${user.firstName}"`, 'error')
        });
      });

      this.showMessage('Usuarios reactivados.', 'success');
      this.selectedUsers = [];
      this.selectAllChecked = false; // 🔹 Reiniciar checkbox “Seleccionar todos”
    });
  }

  // Desactivar usuarios seleccionados
  deactivateSelectedUsers() {
    if (this.selectedUsers.length === 0) {
      this.showMessage('No hay usuarios seleccionados.', 'warning');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Desactivar usuarios',
        message: `¿Desea desactivar a ${this.selectedUsers.length} usuario(s)?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const headers = new HttpHeaders({ userRole: this.userRole });
      this.selectedUsers.forEach(user => {
        this.http.delete(`${this.apiUrl}/${user.id}`, { headers }).subscribe({
          next: () => {
            user.status = 'INACTIVE';
            this.filterUsers();
          },
          error: () => this.showMessage(`Error al desactivar "${user.firstName}"`, 'error')
        });
      });

      this.showMessage('Usuarios desactivados.', 'success');
      this.selectedUsers = [];
      this.selectAllChecked = false; // 🔹 Reiniciar checkbox “Seleccionar todos”
    });
  }
  
  // Filtrar y paginar
  
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
      const role = u.roles[0]?.name.toLowerCase() || '';
      const status = u.status?.toLowerCase() || '';

      // Búsqueda exacta para estado
      const matchStatus =
        (term === 'activo' && status === 'active') ||
        (term === 'inactivo' && status === 'inactive');

      // Búsqueda parcial para nombre, correo y rol
      const matchText =
        fullName.includes(term) ||
        email.includes(term) ||
        role.includes(term);

      return matchText || matchStatus;
    });

    this.setupPagination();
  }


  // Cuando se cambia de página
  setupPagination() {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, end);

    if (this.selectAllGlobal) {
      // Si seleccionamos todos los registros, todos los checkboxes deben aparecer seleccionados
      this.selectAllPage = true;
    } else {
      // Si no es selección global, marcar solo los de la página que ya están seleccionados
      this.selectAllPage = this.paginatedUsers.every(
        u => u.email === this.userEmail || this.selectedUsers.includes(u)
      );
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.setupPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setupPagination();
    }
  }

  // Abrir formulario
  openForm(editMode = false, user?: UserDTO) {
    // Evitar editar usuarios inactivos
    if (user?.status === 'INACTIVE') {
      this.showMessage('No se puede editar un usuario inactivo.', 'warning');
      return;
    }

    this.showForm = true;
    this.editMode = editMode;

    if (editMode && user) {
      this.editingUserId = user.id;
      this.firstName = user.firstName;
      this.lastName = user.lastName;
      this.email = user.email;
      this.password = '';
      this.phoneNumber = user.phoneNumber || '';
      this.role = user.roles[0]?.name || this.roles[0];
    } else {
      this.resetForm();
    }
  }

  cancelForm() {
    this.showForm = false;
    this.editMode = false;
    this.editingUserId = null;
  }

  resetForm() {
    this.firstName = '';
    this.lastName = '';
    this.email = '';
    this.password = '';
    this.phoneNumber = '';
    this.role = this.roles[0] || '';
  }

  private buildUserPayload(): any {
    const payload: any = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      roleName: this.role
    };
    if (!this.editMode || this.password) payload.password = this.password;
    return payload;
  }

  submitForm() {
    if (!this.firstName || !this.lastName || !this.email || (!this.editMode && !this.password)) {
      this.showMessage('Por favor complete todos los campos obligatorios.', 'warning');
      return;
    }

    const payload = this.buildUserPayload();

    if (!this.editMode) {
      // Crear
      this.http.post<UserDTO>(this.apiUrl, payload).subscribe({
        next: user => {
          this.users.push(user);
          this.filterUsers();
          this.cancelForm();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" creado.`, 'success');
        },
        error: () => this.showMessage('Error al crear usuario.')
      });
    } else if (this.editingUserId) {
      // Actualizar
      this.http.put<UserDTO>(`${this.apiUrl}/${this.editingUserId}`, payload).subscribe({
        next: user => {
          const index = this.users.findIndex(u => u.id === this.editingUserId);
          if (index !== -1) this.users[index] = user;
          this.filterUsers();
          this.cancelForm();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" actualizado.`, 'success');
        },
        error: () => this.showMessage('Error al actualizar usuario.', 'error')
      });
    }
  }

  // Desactivar usuario
  deactivateUser(user: UserDTO) {
    // Evitar que el usuario logeado se desactive
    if (user.email === this.userEmail) {
      this.showMessage('No puedes desactivar tu propio usuario.', 'warning');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Desactivar usuario',
        message: `¿Desea desactivar a "${user.firstName} ${user.lastName}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const headers = new HttpHeaders({ userRole: this.userRole });
      this.http.delete(`${this.apiUrl}/${user.id}`, { headers }).subscribe({
        next: () => {
          user.status = 'INACTIVE';
          this.filterUsers();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" desactivado.`, 'success');
        },
        error: err => {
          console.error(err);
          this.showMessage('Error al desactivar usuario.', 'error');
        }
      });
    });
  }

  // Reactivar usuario
  activateUser(user: UserDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Reactivar usuario',
        message: `¿Desea reactivar a "${user.firstName} ${user.lastName}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const headers = new HttpHeaders({ userRole: this.userRole });
      this.http.put(`${this.apiUrl}/${user.id}/activate`, {}, { headers }).subscribe({
        next: () => {
          user.status = 'ACTIVE';
          this.filterUsers();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" reactivado.`, 'success');
        },
        error: err => {
          console.error(err);
          this.showMessage('Error al reactivar usuario.', 'error');
        }
      });
    });
  }
}
