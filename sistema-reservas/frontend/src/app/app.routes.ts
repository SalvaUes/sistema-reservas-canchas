import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

// 1. Importar el Layout (El marco que contiene el Sidebar)
import { MainLayoutComponent } from './shared/layout/main-layout.component';

// 2. Importar Vistas
import { LandingComponent } from './landing/landing.component';
import { AdminComponent } from './admin/admin.component';
import { UsuariosComponent } from './admin/usuarios/usuarios.component';
import { CanchasAdminComponent } from './admin/canchas/canchas.component';
import { ReservasComponent } from './admin/reservas/reservas.component';
import { ClienteComponent } from './cliente/cliente.component';
import { CanchasClienteComponent } from './cliente/canchas/canchas.component';
import { MisReservasComponent } from './cliente/mis-reservas/mis-reservas.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },

  {
    path: '', 
    component: MainLayoutComponent,
    canActivate: [AuthGuard],      
    canActivateChild: [AuthGuard], 
    children: [
      
      // --- Rutas de ADMINISTRADOR ---
      { 
        path: 'admin', 
        component: AdminComponent, 
        data: { roles: ['ADMIN'] }
      },
      { 
        path: 'admin/usuarios', 
        component: UsuariosComponent, 
        data: { roles: ['ADMIN'] } 
      },
      { 
        path: 'admin/canchas', 
        component: CanchasAdminComponent, 
        data: { roles: ['ADMIN'] } 
      },
      { 
        path: 'admin/reservas', 
        component: ReservasComponent, 
        data: { roles: ['ADMIN'] } 
      },

      // --- Rutas de CLIENTE ---
      { 
        path: 'cliente', 
        component: ClienteComponent, 
        data: { roles: ['CLIENTE'] } 
      },
      { 
        path: 'cliente/canchas', 
        component: CanchasClienteComponent, 
        data: { roles: ['CLIENTE'] } 
      },
      { 
        path: 'cliente/mis-reservas', 
        component: MisReservasComponent, 
        data: { roles: ['CLIENTE'] } 
      },

      // Perfil (accesible para ambos, sin data roles o agregando ambos)
      { 
        path: 'perfil', 
        component: ProfileComponent 
      }
    ]
  },

  { path: '**', redirectTo: '' }
];