// src/app/shared/payment-method-dialog/payment-method-dialog.component.ts
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-method-dialog',
  templateUrl: './payment-method-dialog.component.html',
  styleUrls: ['./payment-method-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule]
})
export class PaymentMethodDialogComponent {
  constructor(private dialogRef: MatDialogRef<PaymentMethodDialogComponent>) {}

  select(method: 'CARD' | 'CASH') {
    this.dialogRef.close(method);
  }
}
