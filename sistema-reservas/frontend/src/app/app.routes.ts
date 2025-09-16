import { Routes } from '@angular/router';
import { ClienteComponent } from './cliente/cliente.component';
import { AdminComponent } from './admin/admin.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard } from './services/auth.guard';
import { UsuariosComponent } from './admin/usuarios/usuarios.component';
import { CanchasAdminComponent } from './admin/canchas/canchas.component';
import { ReservasComponent } from './admin/reservas/reservas.component';
import { CanchasClienteComponent } from './cliente/canchas/canchas.component';
import { MisReservasComponent } from './cliente/mis-reservas/mis-reservas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // Cliente
  { path: 'cliente', component: ClienteComponent, canActivate: [AuthGuard], data: { roles: ['CLIENTE'] } },
  { path: 'cliente/canchas', component: CanchasClienteComponent, canActivate: [AuthGuard], data: { roles: ['CLIENTE'] } },
  { path: 'cliente/mis-reservas', component: MisReservasComponent, canActivate: [AuthGuard], data: { roles: ['CLIENTE'] } },

  // Admin
  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/usuarios', component: UsuariosComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/canchas', component: CanchasAdminComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/reservas', component: ReservasComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN'] } },

  // Redirecciones
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
