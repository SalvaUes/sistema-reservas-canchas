import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ReactivateResult {
  code: string;
  message: string;
  status: 'success' | 'failed';
}

@Component({
  selector: 'app-reactivate-error-dialog',
  templateUrl: './reactivate-error-dialog.component.html',
  styleUrls: ['./reactivate-error-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class ReactivateErrorDialogComponent {
  results: ReactivateResult[] = [];

  // Paginación
  currentPage = 1;
  itemsPerPage = 5;
  get totalPages() {
    return Math.ceil(this.results.length / this.itemsPerPage);
  }
  get pagedResults() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.results.slice(start, start + this.itemsPerPage);
  }

  constructor(
    public dialogRef: MatDialogRef<ReactivateErrorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReactivateResult[]
  ) {
    this.results = data;
  }

  close() {
    this.dialogRef.close();
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }
}
