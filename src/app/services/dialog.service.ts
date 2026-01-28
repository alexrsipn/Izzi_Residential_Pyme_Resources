import { CommonModule } from '@angular/common';
import { Component, Inject, Injectable } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialog, MatDialogModule} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  constructor(private dialog: MatDialog) { }

  error(error: Error | string): Observable<void> {
    const dialogRef = this.dialog.open(ErrorDialogComponent, {
      data: error,
    });
    return dialogRef.afterClosed();
  }

  success(message: string): Observable<void> {
    const dialogRef = this.dialog.open(SuccessDialogComponent, {
      data: message,
    });
    return dialogRef.afterClosed();
  }

  confirm(message: string): Observable<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: message,
    });
    return dialogRef.afterClosed();
  }

  invalid(message: string): Observable<void> {
    const dialogRef = this.dialog.open(InvalidDialogComponent, {
      data: message,
      disableClose: true
    });
    return dialogRef.afterClosed();
  }
}

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatDialogModule, CommonModule],
  template: `
    <h1 mat-dialog-title class="mt-4 flex">
      <span>Error </span>
      <span class="self-center">
        <mat-icon aria-hidden="false" aria-label="Error icon" fontIcon="error" color="warn"></mat-icon>
      </span>
    </h1>
    <mat-dialog-content>
      <span *ngIf="data; else unidentifiedError">
        <p>{{data && data}}</p>
        <p>{{data.name && data.name}}</p>
        <p>{{data.message && data.message}}</p>
      </span>
      <ng-template #unidentifiedError>
        <p>Error no identificado</p>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button class="w-full bg-blue-500 text-white py-2 px-4 border rounded" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `
})
export class ErrorDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Error) {}
}

@Component({
  selector: 'app-scc-dialog',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatDialogModule],
  template: `
    <h1 mat-dialog-title class="mt-4 flex">
      <span>Éxito </span>
      <span class="self-center">
        <mat-icon aria-hidden="false" aria-label="Success icon" fontIcon="check_circle" color="primary"></mat-icon>
      </span>
    </h1>
    <mat-dialog-content>
      <p>{{data}}</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button class="w-full bg-blue-500 text-white py-2 px-4 border rounded" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `
})
export class SuccessDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Error) {}
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Confirmar movimiento de recursos</h2>
    <mat-dialog-content>
      <p>{{data}}</p>
    </mat-dialog-content>
    <mat-dialog-actions class="flex justify-around items-center">
      <button class="w-1/2 bg-white text-black py-2 px-4 border rounded" mat-dialog-close [mat-dialog-close]="false">No</button>
      <button class="w-1/2 bg-blue-500 text-white py-2 px-4 border rounded" [mat-dialog-close]="true">Si</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Error) {
  }
}

@Component({
  selector: 'app-invalid-dialog',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Sin autorización</h2>
    <mat-dialog-content>
      <p>{{data}}</p>
    </mat-dialog-content>
  `
})
export class InvalidDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Error) {
  }
}
