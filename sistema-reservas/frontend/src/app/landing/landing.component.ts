import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.scss']
})
export class LandingComponent implements OnInit {
  
  auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {

    this.auth.isAuthenticated$.pipe(
      filter(isAuth => isAuth)
    ).subscribe(() => {
      
      this.auth.userRole$.subscribe(role => {

        if (role) {
          if (role === 'ADMIN') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/cliente']);
          }
        }
      });

    });
  }

  login() {
    this.auth.loginWithRedirect();
  }

  register() {
    this.auth.register();
  }
}