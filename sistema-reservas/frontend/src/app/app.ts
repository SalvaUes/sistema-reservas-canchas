//frontend/src/app/app.ts
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router'; // <-- usar RouterModule, no RouterOutlet
import { HttpClientModule } from '@angular/common/http';
import { NotificationComponent } from "./shared/notificaciones/notificaciones.component";

@Component({
  selector: 'app-root',
  standalone: true, // <-- obligatorio para imports en el componente
  imports: [HttpClientModule, RouterModule, NotificationComponent], // <-- RouterModule en lugar de RouterOutlet
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly title = signal('frontend');
}
