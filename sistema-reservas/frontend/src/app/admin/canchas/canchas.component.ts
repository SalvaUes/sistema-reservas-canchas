import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core'; 
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../usuarios/confirm-dialog.component';
import { environment } from '../../../environments/environment';

interface CourtDTO {
  id: string;
  code: string;
  name: string;
  description?: string;
  sportType: string;
  pricePerHour: number;
  hasReservations?: boolean;
}

@Component({
  selector: 'app-canchas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule, MatDialogModule],
  templateUrl: './canchas.html',
  styleUrls: ['./canchas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush 
})
export class CanchasAdminComponent implements OnInit {
  courts: CourtDTO[] = [];
  filteredCourts: CourtDTO[] = [];
  searchTerm: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm: boolean = false;
  editMode: boolean = false;
  editingCourtId: string | null = null;

  private apiUrl = `${environment.apiUrl}/courts`;

  // Formulario cancha
  code: string = '';
  name: string = '';
  description: string = '';
  sportType: string = '';
  sportTypes: string[] = ['Fútbol', 'Baloncesto', 'Vóleibol', 'Tenis', 'Padel'];
  pricePerHour: number = 0;

  paginatedCourts: CourtDTO[] = [];
  selectedCourts: CourtDTO[] = [];
  selectAllPage = false;
  selectAllGlobal = false;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  userEmail = '';
  userRole = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.userEmail = this.auth.getUserEmail() || 'admin@correo.com';
    this.userRole = this.auth.getUserRole() || 'ROL_NO_DEFINIDO';
  }

  ngOnInit() {
    this.loadCourts();
  }

  logout() {
    this.auth.logout();
  }

  loadCourts() {
    this.http.get<CourtDTO[]>(this.apiUrl).subscribe({
      next: (res: CourtDTO[]) => {
        this.courts = res;
        this.filterCourts();
        this.cdr.markForCheck(); 
      },
      error: () => {
        this.showMessage('Error al cargar canchas', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  private normalizeString(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
    // No necesitamos markForCheck aquí porque filterCourts suele llamarse desde loadCourts (que ya marca)
    // o desde el input (evento DOM) que en OnPush marca automáticamente.
  }

  setPaginatedCourts() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedCourts = this.filteredCourts.slice(start, start + this.pageSize);
    this.updateSelectAllFlags(); // Asegurar que los checkbox se actualicen
  }

  get selectedCount(): number {
    return this.selectedCourts.length;
  }

  nextPage() { 
      if(this.currentPage < this.totalPages) { 
          this.currentPage++; 
          this.setPaginatedCourts(); 
          // El click lo detecta, pero por seguridad:
          this.cdr.markForCheck(); 
      } 
  }
  
  previousPage() { 
      if(this.currentPage > 1) { 
          this.currentPage--; 
          this.setPaginatedCourts(); 
          this.cdr.markForCheck();
      } 
  }

  toggleSelection(court: CourtDTO, event: any) {
    if (court.hasReservations) return;
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
    const checked = event.target.checked;
    
    this.cdr.detach();

    if (checked) {
      // Filtrar masivamente
      this.selectedCourts = this.filteredCourts.filter(c => !c.hasReservations);
      this.showMessage('Estás seleccionando todos los registros.', 'warning');
    } else {
      this.selectedCourts = [];
    }
    
    this.updateSelectAllFlags();

    // Reconectamos y marcamos
    this.cdr.reattach();
    this.cdr.markForCheck();
  }

  updateSelectAllFlags() {
    this.selectAllPage = this.paginatedCourts.length > 0 && this.paginatedCourts.every(c => c.hasReservations || this.selectedCourts.includes(c));
    const selectables = this.filteredCourts.filter(c => !c.hasReservations).length;
    this.selectAllGlobal = selectables > 0 && this.selectedCourts.length === selectables;
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
    this.cdr.markForCheck(); 
  }

  cancelForm() {
    this.showForm = false;
    this.editMode = false;
    this.editingCourtId = null;
    this.cdr.markForCheck(); 
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
      this.http.post<CourtDTO>(this.apiUrl, payload).subscribe({
        next: (court: CourtDTO) => {
          this.courts.push(court);
          this.filterCourts();
          this.cancelForm();
          this.showMessage(`Cancha "${court.name}" creada con éxito.`, 'success');
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error(err);
          this.showMessage('Ocurrió un error al crear la cancha. Intente nuevamente.');
          this.cdr.markForCheck();
        }
      });
    } else if (this.editingCourtId) {
      this.http.put<CourtDTO>(`${this.apiUrl}/${this.editingCourtId}`, payload).subscribe({
        next: (court: CourtDTO) => {
          const index = this.courts.findIndex(c => c.id === this.editingCourtId);
          if (index !== -1) this.courts[index] = court;
          this.filterCourts();
          this.cancelForm();
          this.showMessage(`Cancha "${court.name}" actualizada correctamente.`, 'success');
          this.cdr.markForCheck(); 
        },
        error: (err: any) => {
          console.error(err);
          this.showMessage('Ocurrió un error al actualizar la cancha. Intente nuevamente.');
          this.cdr.markForCheck();
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
      this.http.delete(`${this.apiUrl}/${courtId}`).subscribe({
        next: () => { 
            this.courts = this.courts.filter(c => c.id !== courtId); 
            this.filterCourts(); 
            this.showMessage(`Cancha "${court.name}" eliminada.`, 'success'); 
            this.cdr.markForCheck(); // Refrescar vista
        },
        error: err => { 
            console.error(err); 
            this.showMessage('Error al eliminar la cancha.'); 
            this.cdr.markForCheck();
        }
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
      const observables = this.selectedCourts.map(court => this.http.delete(`${this.apiUrl}/${court.id}`));
      
      Promise.all(observables.map(obs => obs.toPromise()))
        .then(() => { 
          this.courts = this.courts.filter(c => !this.selectedCourts.includes(c)); 
          this.selectedCourts = []; 
          this.filterCourts(); 
          this.showMessage('Canchas eliminadas correctamente.', 'success'); 
          this.cdr.markForCheck(); // Refrescar vista tras promesa
        })
        .catch(err => { 
            console.error(err); 
            this.showMessage('Error al eliminar las canchas.'); 
            this.cdr.markForCheck();
        });
    });
  }

  private showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }
}