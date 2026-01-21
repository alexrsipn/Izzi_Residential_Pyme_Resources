import {ChangeDetectionStrategy, Component, Input, signal} from '@angular/core';
import {MatCheckboxModule} from "@angular/material/checkbox";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {provideNativeDateAdapter} from "@angular/material/core";
import {MatCardModule} from "@angular/material/card";
import {MatInputModule} from "@angular/material/input";
import {MatIconModule} from "@angular/material/icon";
import {AppStore} from "../../app.store";
import {AsyncPipe, NgForOf, NgIf} from "@angular/common";
import {Resource} from "../../types/ofs-rest-api";
import {ResourceTreeComponent} from "../resource-tree/resource-tree.component";
import {ControlDateComponent} from "../control-date/control-date.component";
import {MatButtonToggleModule} from "@angular/material/button-toggle";

@Component({
  selector: 'app-residencial-layout',
  standalone: true,
  imports: [MatCheckboxModule, FormsModule, MatFormFieldModule, MatDatepickerModule, MatCardModule, MatInputModule, MatIconModule, NgIf, AsyncPipe, ResourceTreeComponent, ControlDateComponent, MatButtonToggleModule],
  templateUrl: './residencial-layout.component.html',
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResidencialLayoutComponent {
  vm$ = this.store.vm$;
  value: string = "";

  constructor(protected readonly store: AppStore) {}

  resources: Resource | undefined = undefined;
}
