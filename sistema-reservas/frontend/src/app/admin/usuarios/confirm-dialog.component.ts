// frontend/src/app/admin/usuarios/confirm-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string; // Texto del botón confirmar
  cancelText?: string;  // Texto del botón cancelar
  confirmColor?: 'primary' | 'warn' | 'accent'; // Color opcional del botón confirmar
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="dialog-content">
      {{ data.message }}
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button color="inherit" aria-label="Cancelar" (click)="onCancel()">
        {{ data.cancelText || 'Cancelar' }}
      </button>
      <button mat-raised-button [color]="data.confirmColor || 'warn'" aria-label="Confirmar" (click)="onConfirm()">
        {{ data.confirmText || 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      margin: 1rem 0;
      font-size: 0.95rem;
      color: #333;
    }
    mat-dialog-actions button {
      min-width: 90px;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm() {
    this.dialogRef.close(true); // Devuelve true al confirmar
  }

  onCancel() {
    this.dialogRef.close(false); // Devuelve false al cancelar
  }
}
