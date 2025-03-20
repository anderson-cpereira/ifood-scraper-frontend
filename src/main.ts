import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HomeComponent } from './app/home/home.component';

bootstrapApplication(HomeComponent, {
  providers: [
    provideHttpClient()
  ]
}).catch(err => console.error(err));