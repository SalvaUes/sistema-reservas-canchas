import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

interface UserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  roles: { name: string }[];
  status?: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss'],
})
export class UsuariosComponent implements OnInit {
  users: UserDTO[] = [];
  filteredUsers: UserDTO[] = [];
  searchTerm: string = '';
  showForm: boolean = false;
  editMode: boolean = false;
  editingUserId: number | null = null;
  showPassword: boolean = false;

  // Formulario usuario
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  phoneNumber: string = '';
  role: string = '';
  roles: string[] = [];

  // Barra lateral
  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private snackBar: MatSnackBar,
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

  private showMessage(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  loadUsers() {
    this.http.get<UserDTO[]>('http://localhost:8080/api/users').subscribe(res => {
      this.users = res;
      this.filterUsers();
    });
  }

  loadRoles() {
    this.http.get<{ name: string }[]>('http://localhost:8080/api/roles').subscribe(res => {
      this.roles = res.map(r => r.name);
      if (!this.role && this.roles.length > 0) this.role = this.roles[0];
    });
  }

  filterUsers() {
    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(
      u =>
        u.firstName.toLowerCase().includes(term) ||
        u.lastName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }

  openForm(editMode = false, user?: UserDTO) {
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
      this.editingUserId = null;
      this.firstName = '';
      this.lastName = '';
      this.email = '';
      this.password = '';
      this.phoneNumber = '';
      this.role = this.roles[0] || '';
    }
  }

  cancelForm() {
    this.showForm = false;
    this.editMode = false;
    this.editingUserId = null;
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
      this.showMessage('Por favor complete todos los campos obligatorios antes de continuar.');
      return;
    }

    const payload = this.buildUserPayload();

    if (!this.editMode) {
      // Crear usuario
      this.http.post<UserDTO>('http://localhost:8080/api/users', payload).subscribe({
        next: user => {
          this.users.push(user);
          this.filterUsers();
          this.cancelForm();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" creado con éxito.`);
        },
        error: err => {
          console.error(err);
          this.showMessage('Ocurrió un error al crear el usuario. Intente nuevamente.');
        }
      });
    } else if (this.editingUserId) {
      // Editar usuario
      this.http.put<UserDTO>(`http://localhost:8080/api/users/${this.editingUserId}`, payload).subscribe({
        next: user => {
          const index = this.users.findIndex(u => u.id === this.editingUserId);
          if (index !== -1) this.users[index] = user;
          this.filterUsers();
          this.cancelForm();
          this.showMessage(`Usuario "${user.firstName} ${user.lastName}" actualizado correctamente.`);
        },
        error: err => {
          console.error(err);
          this.showMessage('Ocurrió un error al actualizar el usuario. Intente nuevamente.');
        }
      });
    }
  }

  deleteUser(userId: number) {
    const user = this.users.find(u => u.id === userId);

    if (!user) return;

    // No permitir eliminarse a sí mismo
    if (user.email === this.userEmail) {
      this.showMessage('No puede eliminar su propio usuario.');
      return;
    }

    if (this.userRole !== 'ADMIN') {
      this.showMessage('Solo los administradores tienen permisos para eliminar usuarios.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Está seguro que desea eliminar al usuario "${user.firstName} ${user.lastName}"? Esta acción no se puede deshacer.`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.delete(`http://localhost:8080/api/users/${userId}`, { headers: { userRole: this.userRole } })
        .subscribe({
          next: () => {
            this.users = this.users.filter(u => u.id !== userId);
            this.filterUsers();
            this.showMessage(`Usuario "${user.firstName} ${user.lastName}" eliminado correctamente.`);
          },
          error: err => {
            console.error(err);
            this.showMessage('Ocurrió un error al eliminar el usuario. Intente nuevamente.');
          }
        });
    });
  }

}
