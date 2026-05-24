import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import localePt from '@angular/common/locales/pt';
import { AppComponent } from './app/app';

registerLocaleData(localePt);

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'pt-PT' }
  ]
}).catch((err) => console.error(err));