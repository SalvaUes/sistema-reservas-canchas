import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface PaymentFormData {
  reservationId: string;       // UUID
  method: 'CARD' | 'CASH';
}

interface ReservationDTO {
  id: string;
  code: string;
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
  id = '';
  code = '';
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
      customerPhone: [
        '',
        [Validators.required, Validators.pattern(/^[0-9]{8,15}$/)] // solo dígitos, entre 8 y 15
      ],
      cardNumber: [''],
      cardExpiry: [''],
      amount: [0, Validators.required]
    });

    // Validadores solo si se paga con tarjeta
    if (data.method === 'CARD') {
      this.form.get('cardNumber')?.setValidators([Validators.required, this.cardNumberValidator]);
      this.form.get('cardExpiry')?.setValidators([Validators.required, cardExpiryValidator]);
    }
  }

  ngOnInit() {
    console.log('Payment data', this.data);

    if (this.data.reservationId) {
      this.http.get<ReservationDTO>(
        `http://localhost:8080/api/reservations/${this.data.reservationId}`
      ).subscribe({
        next: res => {
          console.log('Reserva cargada:', res);
          this.id = res.id;
          this.code = res.code;
          this.courtName = res.courtName;
          this.startTime = res.startTime;
          this.endTime = res.endTime;
          this.pricePerHour = Number(res.pricePerHour);
          this.totalPrice = Number(res.totalPrice);
          this.form.patchValue({ amount: this.totalPrice });
        },
        error: err => {
          console.error('Error al cargar la reserva', err);
        }
      });
    }
  }

  onlyNumbers(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  // ---------------- VALIDAR NÚMERO DE TARJETA ----------------
  private cardNumberValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const cleanValue = control.value.replace(/\s+/g, '');
    return /^\d{16}$/.test(cleanValue) ? null : { invalidCardNumber: true };
  }

  // ---------------- FORMATEAR NÚMERO DE TARJETA ----------------
  formatCardNumber(event: any) {
    let input = event.target.value.replace(/\D/g, '');
    let formatted = input.match(/.{1,4}/g)?.join(' ') ?? input;
    event.target.value = formatted;
    this.form.get('cardNumber')?.setValue(formatted, { emitEvent: false });
  }

  // ---------------- FORMATEAR FECHA DE EXPIRACIÓN ----------------
  formatCardExpiry(event: any) {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 2) input = input.substring(0, 2) + '/' + input.substring(2, 4);
    event.target.value = input;
    this.form.get('cardExpiry')?.setValue(input, { emitEvent: false });
  }

  // ---------------- SUBMIT ----------------
  submit() {
    if (this.form.valid) {
      const payload = {
        reservationId: this.id,          // UUID como string
        amount: this.form.value.amount,
        method: this.data.method,
        customerName: this.form.value.customerName,
        customerEmail: this.form.value.customerEmail,
        customerPhone: this.form.value.customerPhone,
        cardNumber: this.form.value.cardNumber,
        cardExpiry: this.form.value.cardExpiry
      };

      this.dialogRef.close(payload);
    }
  }
}
