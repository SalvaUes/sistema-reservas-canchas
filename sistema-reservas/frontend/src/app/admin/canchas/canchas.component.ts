import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
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
  hasReservations?: boolean;
}

@Component({
  selector: 'app-canchas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
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


  paginatedCourts: CourtDTO[] = [];
  selectedCourts: CourtDTO[] = [];
  selectAllPage = false;
  selectAllGlobal = false;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Barra lateral
  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

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

  loadCourts() {
    this.http.get<CourtDTO[]>(API_URL).subscribe((res: CourtDTO[]) => {
      this.courts = res;
      this.filterCourts();
    });
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')              // descompone caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // elimina los diacríticos
      .toLowerCase();
  }

  filterCourts() {
    const term = this.normalizeString(this.searchTerm);

    let results = this.courts.filter(c =>
      this.normalizeString(c.name).includes(term) ||
      this.normalizeString(c.code).includes(term) ||
      this.normalizeString(c.sportType).includes(term) ||
      c.pricePerHour.toString().includes(term)
    );

    results.sort((a,b) =>
      this.sortDirection === 'asc'
        ? a.pricePerHour - b.pricePerHour
        : b.pricePerHour - a.pricePerHour
    );

    this.filteredCourts = results;
    this.totalPages = Math.ceil(results.length / this.pageSize);
    this.setPaginatedCourts();
  }


  setPaginatedCourts() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedCourts = this.filteredCourts.slice(start, start + this.pageSize);
  }

  get selectedCount(): number {
    return this.selectedCourts.length;
  }

  // Paginación
  nextPage() { this.currentPage++; this.setPaginatedCourts(); }
  previousPage() { this.currentPage--; this.setPaginatedCourts(); }

  // Selección de filas
  toggleSelection(court: CourtDTO, event: any) {
    if (court.hasReservations) return; // no permitir selección
    if (event.target.checked) this.selectedCourts.push(court);
    else this.selectedCourts = this.selectedCourts.filter(c => c !== court);
    this.updateSelectAllFlags();
  }

  toggleSelectAllPage(event: any) {
    if (event.target.checked) {
      this.paginatedCourts.forEach(c => {
        if (!c.hasReservations && !this.selectedCourts.includes(c)) {
          this.selectedCourts.push(c);
        }
      });
    } else {
      this.paginatedCourts.forEach(c => {
        this.selectedCourts = this.selectedCourts.filter(s => s !== c);
      });
    }
    this.updateSelectAllFlags();
  }

  toggleSelectAllGlobal(event: any) {
    if (event.target.checked) {
      this.selectedCourts = this.filteredCourts.filter(c => !c.hasReservations);
            this.showMessage('Estás seleccionando todos los registros.', 'warning');
    } else {
      this.selectedCourts = [];
    }
    this.updateSelectAllFlags();
  }

  updateSelectAllFlags() {
    this.selectAllPage = this.paginatedCourts.every(c => c.hasReservations || this.selectedCourts.includes(c));
    this.selectAllGlobal = this.selectedCourts.length === this.filteredCourts.filter(c => !c.hasReservations).length;
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
      name: this.name,
      description: this.description,
      sportType: this.sportType,
      pricePerHour: this.pricePerHour
    };
  }

  submitForm() {
    if (!this.name || !this.sportType || this.pricePerHour <= 0) {
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
          this.showMessage(`Cancha "${court.name}" creada con éxito.`, 'success');
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
          this.showMessage(`Cancha "${court.name}" actualizada correctamente.`, 'success');
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
    if (!court || court.hasReservations) return;
    if (this.userRole !== 'ADMIN') { this.showMessage('Solo administradores pueden eliminar.'); return; }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { title: 'Confirmar eliminación', message: `¿Desea eliminar la cancha "${court.name}"?` }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      this.http.delete(`${API_URL}/${courtId}`).subscribe({
        next: () => { this.courts = this.courts.filter(c => c.id !== courtId); this.filterCourts(); this.showMessage(`Cancha "${court.name}" eliminada.`, 'success'); },
        error: err => { console.error(err); this.showMessage('Error al eliminar la cancha.'); }
      });
    });
  }

  deleteSelectedCourts() {
    if (!this.selectedCourts.length) return;
    const names = this.selectedCourts.map(c => c.name).join(', ');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { title: 'Confirmar eliminación', message: `¿Eliminar las canchas: ${names}?` }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      const observables = this.selectedCourts.map(court => this.http.delete(`${API_URL}/${court.id}`));
      Promise.all(observables.map(obs => obs.toPromise()))
        .then(() => { 
          this.courts = this.courts.filter(c => !this.selectedCourts.includes(c)); 
          this.selectedCourts = []; 
          this.filterCourts(); 
          this.showMessage('Canchas eliminadas correctamente.', 'success'); 
        })
        .catch(err => { console.error(err); this.showMessage('Error al eliminar las canchas.'); });
    });
  }

  showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }
}
