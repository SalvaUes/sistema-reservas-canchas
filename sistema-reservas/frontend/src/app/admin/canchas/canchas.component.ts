import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../usuarios/confirm-dialog.component';

const API_URL = 'http://localhost:8080/api/courts';

interface CourtDTO {
  id: string; // UUID
  code: string; // Código de cancha
  name: string;
  description?: string;
  sportType: string;
  pricePerHour: number;
}

@Component({
  selector: 'app-canchas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './canchas.html',
  styleUrls: ['./canchas.scss'],
})
export class CanchasAdminComponent implements OnInit {
  courts: CourtDTO[] = [];
  filteredCourts: CourtDTO[] = [];
  searchTerm: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm: boolean = false;
  editMode: boolean = false;
  editingCourtId: string | null = null;

  // Formulario cancha
  code: string = '';
  name: string = '';
  description: string = '';
  sportType: string = '';
  sportTypes: string[] = [
  'Fútbol',
  'Baloncesto',
  'Vóleibol',
  'Tenis',
  'Padel'
  ];
  pricePerHour: number = 0;

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
    this.loadCourts();
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

  private showMessage(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  loadCourts() {
    this.http.get<CourtDTO[]>(API_URL).subscribe((res: CourtDTO[]) => {
      this.courts = res;
      this.filterCourts();
    });
  }

  filterCourts() {
    const term = this.searchTerm.toLowerCase();
  
    let results = this.courts.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.sportType.toLowerCase().includes(term) ||
      c.pricePerHour.toString().includes(term) // <-- permite buscar por precio
    );
  
    // Ordenar por precio
    results.sort((a, b) =>
      this.sortDirection === 'asc'
        ? a.pricePerHour - b.pricePerHour
        : b.pricePerHour - a.pricePerHour
    );
  
    this.filteredCourts = results;
  }

  toggleSortByPrice() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterCourts();
  }

  openForm(editMode = false, court?: CourtDTO) {
    this.showForm = true;
    this.editMode = editMode;

    if (editMode && court) {
      this.editingCourtId = court.id;
      this.code = court.code;
      this.name = court.name;
      this.description = court.description || '';
      this.sportType = court.sportType;
      this.pricePerHour = court.pricePerHour;
    } else {
      this.editingCourtId = null;
      this.code = '';
      this.name = '';
      this.description = '';
      this.sportType = '';
      this.pricePerHour = 0;
    }
  }

  cancelForm() {
    this.showForm = false;
    this.editMode = false;
    this.editingCourtId = null;
  }

  private buildCourtPayload(): any {
    return {
      code: this.code,
      name: this.name,
      description: this.description,
      sportType: this.sportType,
      pricePerHour: this.pricePerHour
    };
  }

  submitForm() {
    if (!this.code || !this.name || !this.sportType || this.pricePerHour <= 0) {
      this.showMessage('Por favor complete todos los campos obligatorios antes de continuar.');
      return;
    }

    const payload = this.buildCourtPayload();

    if (!this.editMode) {
      // Crear cancha
      this.http.post<CourtDTO>(API_URL, payload).subscribe({
        next: (court: CourtDTO) => {
          this.courts.push(court);
          this.filterCourts();
          this.cancelForm();
          this.showMessage(`Cancha "${court.name}" creada con éxito.`);
        },
        error: (err: any) => {
          console.error(err);
          this.showMessage('Ocurrió un error al crear la cancha. Intente nuevamente.');
        }
      });
    } else if (this.editingCourtId) {
      // Editar cancha
      this.http.put<CourtDTO>(`${API_URL}/${this.editingCourtId}`, payload).subscribe({
        next: (court: CourtDTO) => {
          const index = this.courts.findIndex(c => c.id === this.editingCourtId);
          if (index !== -1) this.courts[index] = court;
          this.filterCourts();
          this.cancelForm();
          this.showMessage(`Cancha "${court.name}" actualizada correctamente.`);
        },
        error: (err: any) => {
          console.error(err);
          this.showMessage('Ocurrió un error al actualizar la cancha. Intente nuevamente.');
        }
      });
    }    
  }

  deleteCourt(courtId: string) {
    const court = this.courts.find(c => c.id === courtId);
    if (!court) return;

    if (this.userRole !== 'ADMIN') {
      this.showMessage('Solo los administradores tienen permisos para eliminar canchas.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Está seguro que desea eliminar la cancha "${court.name}"? Esta acción no se puede deshacer.`
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (!result) return;

      this.http.delete(`${API_URL}/${courtId}`, { headers: { userRole: this.userRole } })
        .subscribe({
          next: () => {
            this.courts = this.courts.filter(c => c.id !== courtId);
            this.filterCourts();
            this.showMessage(`Cancha "${court.name}" eliminada correctamente.`);
          },
          error: (err: any) => {
            console.error(err);
            this.showMessage('Ocurrió un error al eliminar la cancha. Intente nuevamente.');
          }
        });
    });
  }
}
