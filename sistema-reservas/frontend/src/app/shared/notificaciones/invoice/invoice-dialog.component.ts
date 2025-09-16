import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceDialogData {
  invoice: {
    reservationId: string;      // UUID
    reservationCode: string;    // R-XXXXXXX
    invoiceNumber: string;
    amount: number;
    method: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    status: string;
    paymentDate: string;
  };
}


@Component({
  selector: 'app-invoice-dialog',
  templateUrl: './invoice-dialog.component.html',
  styleUrls: ['./invoice-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe]
})
export class InvoiceDialogComponent {
  formattedDate: string;
  displayReservationCode: string;

  constructor(
    public dialogRef: MatDialogRef<InvoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InvoiceDialogData,
    private datePipe: DatePipe
  ) {
    this.formattedDate = this.datePipe.transform(
      data.invoice.paymentDate,
      'short'
    ) || '';

    // Ajuste: solo mostrar la parte legible del código
    // Si tu código real viene como RES-UUID, extraemos números/primera parte
    const match = data.invoice.reservationCode.match(/RES-(\w{8})/);
    this.displayReservationCode = match ? `R-${match[1]}` : data.invoice.reservationCode;
  }

  downloadPDF() {
    const doc = new jsPDF();

    // ------------------ Título ------------------
    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text('Factura de Reservas', 105, 15, { align: 'center' });

    // ------------------ Sección Cliente ------------------
    autoTable(doc, {
      startY: 25,
      head: [['Cliente', 'Información']],
      body: [
        ['Nombre', this.data.invoice.customerName],
        ['Email', this.data.invoice.customerEmail],
        ['Teléfono', this.data.invoice.customerPhone]
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
      bodyStyles: { halign: 'left', textColor: 30 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      styles: { fontSize: 12, cellPadding: 5 }
    });

    // ------------------ Sección Reserva ------------------
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Reserva', 'Detalle']],
      body: [
        ['Factura', this.data.invoice.invoiceNumber],
        ['Código de Reserva', this.displayReservationCode],
        ['Monto', `$${this.data.invoice.amount}`],
        ['Método de pago', this.data.invoice.method],
        ['Estado del pago', this.data.invoice.status],
        ['Fecha de pago', this.formattedDate]
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
      bodyStyles: { halign: 'left', textColor: 30 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 12, cellPadding: 5 }
    });

    // ------------------ Footer ------------------
    const finalY = (doc as any).lastAutoTable.finalY || 0;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Gracias por su preferencia', 105, finalY + 15, { align: 'center' });

    // ------------------ Guardar PDF ------------------
    doc.save(`Factura-${this.data.invoice.invoiceNumber}.pdf`);
  }
}
