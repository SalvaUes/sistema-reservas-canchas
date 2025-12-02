import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ReactivationEvent {
  reactived?: boolean;
  cancelled?: boolean;
  reservationId?: string;
}

@Injectable({ providedIn: 'root' })
export class ReservationReactivatedService {
  reservationReactivated = new Subject<ReactivationEvent>();

  emitReactivation(id: string) {
    this.reservationReactivated.next({
      reactived: true,
      reservationId: id
    });
  }

  emitCancellation(id: string) {
    this.reservationReactivated.next({
      cancelled: true,
      reservationId: id
    });
  }
}