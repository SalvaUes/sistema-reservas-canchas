import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface PaymentFormData {
  reservationId: number;
  method: 'CARD' | 'CASH';
}

interface ReservationDetailDTO {
  courtName: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  totalPrice: number;
}

// ---------------- VALIDADOR DE FECHA DE EXPIRACIÓN ----------------
function cardExpiryValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const value = control.value.trim();
  const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!regex.test(value)) return { invalidExpiry: true };

  const [month, year] = value.split('/');
  const expMonth = parseInt(month, 10);
  const expYear = 2000 + parseInt(year, 10);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return { invalidExpiry: true };
  }
  return null;
}

@Component({
  selector: 'app-payment-form-dialog',
  templateUrl: './payment-form-dialog.component.html',
  styleUrls: ['./payment-form-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ]
})
export class PaymentFormDialogComponent implements OnInit {
  form: FormGroup;

  // Datos de la reserva
  courtName = '';
  startTime = '';
  endTime = '';
  pricePerHour = 0;
  totalPrice = 0;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PaymentFormDialogComponent>,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: PaymentFormData
  ) {
    this.form = this.fb.group({
      customerName: ['', Validators.required],
      customerEmail: ['', [Validators.required, Validators.email]],
      customerPhone: ['', Validators.required],
      cardNumber: [''],
      cardExpiry: [''],
      amount: [0, Validators.required] // monto a pagar
    });

    // Validadores para pago con tarjeta
    if (data.method === 'CARD') {
      this.form.get('cardNumber')?.setValidators([Validators.required, this.cardNumberValidator]);
      this.form.get('cardExpiry')?.setValidators([Validators.required, cardExpiryValidator]);
    }
  }

  ngOnInit() {
    // Cargar detalles de la reserva desde API
    if (this.data.reservationId) {
      this.http.get<ReservationDetailDTO>(`http://localhost:8080/api/reservations/${this.data.reservationId}/details`)
        .subscribe(res => {
          this.courtName = res.courtName;
          this.startTime = res.startTime;
          this.endTime = res.endTime;
          this.pricePerHour = res.pricePerHour;
          this.totalPrice = res.totalPrice;

          // Actualizar formulario con el monto total
          this.form.patchValue({ amount: this.totalPrice });
        });
    }
  }

  // ---------------- VALIDAR NÚMERO DE TARJETA ----------------
  private cardNumberValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const cleanValue = control.value.replace(/\s+/g, '');
    const regex = /^\d{16}$/;
    return regex.test(cleanValue) ? null : { invalidCardNumber: true };
  }

  // ---------------- FORMATEAR TARJETA ----------------
  formatCardNumber(event: any) {
    let input = event.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let formatted = '';
    for (let i = 0; i < input.length; i += 4) {
      formatted += input.substring(i, i + 4) + ' ';
    }
    event.target.value = formatted.trim();
    this.form.get('cardNumber')?.setValue(formatted.trim(), { emitEvent: false });
  }

  // ---------------- FORMATEAR FECHA EXPIRACIÓN ----------------
  formatCardExpiry(event: any) {
    let input = event.target.value.replace(/[^0-9]/g, '');
    if (input.length >= 3) {
      input = input.substring(0, 2) + '/' + input.substring(2, 4);
    }
    event.target.value = input;
    this.form.get('cardExpiry')?.setValue(input, { emitEvent: false });
  }

  // ---------------- SUBMIT ----------------
  submit() {
    if (this.form.valid) {
      const payload = {
        amount: this.form.value.amount,               // number -> BigDecimal
        method: this.data.method,                     // 'CARD' o 'CASH'
        customerName: this.form.value.customerName,
        customerEmail: this.form.value.customerEmail,
        customerPhone: this.form.value.customerPhone
      };

      this.dialogRef.close(payload);
    }
  }
}
