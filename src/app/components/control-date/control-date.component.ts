import {
  ChangeDetectionStrategy,
  Component,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { map } from 'rxjs';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import moment from 'moment';
import { MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';
import { NativeDateAdapter } from '@angular/material/core';

const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMM YYYY',
  },
};

@Component({
  selector: 'app-control-date',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    ReactiveFormsModule,
    MatDividerModule,
    MatButtonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
    { provide: DateAdapter, useClass: NativeDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
  ],
  templateUrl: './control-date.component.html',
})
export class ControlDateComponent {

  range = new FormGroup({
    start: new FormControl<Date | null>(null, [Validators.required]),
    end: new FormControl<Date | null>(null, [
      Validators.required,
      this.maxAllowedRangeValidator,
    ]),
  });

  dateFilter = (d: Date | null): boolean => {
    const futureMoment = moment().add(90, 'days');
    const today = new Date(moment().format('YYYY-MM-DD'));
    const future = new Date(futureMoment.format('YYYY-MM-DD'));
    return d ? d >= today && d < future : false;
  };

  @Output() rangeChange = this.range.valueChanges.pipe(
    map((range) => ({
      from: range.start ? this.toFormattedDateString(range.start) : null,
      to: range.end ? this.toFormattedDateString(range.end) : null,
      valid: this.range.valid,
    }))
  );

  private toFormattedDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private maxAllowedRangeValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const start: Date | null = control.parent?.get('start')?.value;
    const end: Date | null = control.value;
    if (!start || !end) return null;

    const maxAllowedRange = 15;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const differenceInMilliseconds = Math.abs(end.getTime() - start.getTime());
    const differenceInDays = differenceInMilliseconds / millisecondsPerDay;

    return differenceInDays > maxAllowedRange
      ? { maxAllowedRange: true }
      : null;
  }
}
