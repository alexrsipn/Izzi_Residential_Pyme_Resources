import {Component} from '@angular/core';
import {MatCheckboxChange, MatCheckboxModule} from "@angular/material/checkbox";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatIcon} from "@angular/material/icon";
import {MatInput} from "@angular/material/input";
import {MatTooltipModule} from "@angular/material/tooltip";
import {AppStore} from "../../app.store";
import {AsyncPipe, NgIf} from "@angular/common";
import {Resource} from "../../types/ofs-rest-api";
import {ResourceTreeComponent} from "../resource-tree/resource-tree.component";

@Component({
  selector: 'app-pyme-layout',
  standalone: true,
  imports: [
    MatCheckboxModule, FormsModule, MatCardModule, MatSlideToggleModule, MatFormField, MatIcon, MatInput, MatLabel, MatTooltipModule, AsyncPipe, NgIf, ResourceTreeComponent
  ],
  templateUrl: './pyme-layout.component.html',
})
export class PymeLayoutComponent {
  vm$ = this.store.vm$;

  constructor(protected readonly store: AppStore) {}

  searchTerm = "";

  onSelectionChange(event: MatCheckboxChange, resourceNode: Resource): void {
    const isSelected = event.checked;
    this.store.togglePymeSelection({resource: resourceNode, isSelected});
  }
}
