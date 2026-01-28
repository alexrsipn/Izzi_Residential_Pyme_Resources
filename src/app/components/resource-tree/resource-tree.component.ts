import {Component, inject, Input, SimpleChanges} from '@angular/core';
import {Resource} from "../../types/ofs-rest-api";
import {CommonModule} from "@angular/common";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatCheckboxChange, MatCheckboxModule} from "@angular/material/checkbox";
import {FormsModule} from "@angular/forms";
import {AppStore} from "../../app.store";
import {MatIconModule} from "@angular/material/icon";
import dayjs from 'dayjs';

@Component({
  selector: 'app-resource-tree',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatCheckboxModule, FormsModule, MatIconModule],
  templateUrl: './resource-tree.component.html',
})
export class ResourceTreeComponent {
  @Input() resourceNode!: Resource;
  @Input() searchTerm: string = '';
  @Input() type: 'residencial' | 'pyme' = 'residencial';

  private readonly store = inject(AppStore);
  vm$ = this.store.vm$;

  displayableNodes: Resource | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resourceNode'] || changes['searchTerm']) {
      this.filterTree();
    }
  }

  private filterTree(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.displayableNodes = this.resourceNode;
      return;
    } else {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      console.log(lowerSearchTerm);
      const filteredNode = this._filterSingleNodeRecursive(this.resourceNode, lowerSearchTerm);
      this.displayableNodes = filteredNode ? filteredNode : null;
    }
  }

  private _filterSingleNodeRecursive(node: Resource, term: string): Resource | null {
    const isMatch = node.resourceId.toLowerCase().includes(term) || node.name.toLowerCase().includes(term);
    let filteredChildren: Resource[] | undefined = undefined;
    if (node.children && node.children.length > 0) {
      filteredChildren = this._filterNodesRecursive(node.children, term);
    }

    if (isMatch || (filteredChildren)) {
      return {
        ...node,
        children: filteredChildren ? filteredChildren : undefined
      };
    }
    return null;
  }

  private _filterNodesRecursive(nodes: Resource[], term: string): Resource[] | undefined {
    const node = nodes.map(node => this._filterSingleNodeRecursive(node, term)).filter(node => node !== null);
    return node.length > 0 ? node : undefined;
  }

  onSelectionChange(event: MatCheckboxChange): void {
    const isSelected = event.checked;
    if (this.type === 'pyme') {
      this.store.togglePymeSelection({resource: this.resourceNode, isSelected})
    } else {
      this.store.toggleResidentialSelection({resource: this.resourceNode, isSelected})
    }
  }

  getSkillIcons(resource: Resource): {icon: string, tooltip: string, color: string}[]{
    const icons: {icon: string, tooltip: string, color: string}[] = [];
    if (!resource.workSkills?.items) return icons;
    const today = dayjs();
    const skills = resource.workSkills.items.filter(skill => {
      const endDate = skill.endDate ? dayjs(skill.endDate) : null;
      return !endDate || !today.isAfter(endDate, 'day');
    }).map(s => s.workSkill);
    if (skills.includes('PYME')) {
      icons.push({icon: 'store', tooltip: 'PyME Multiskill', color: 'text-blue-500'});
    }
    if (skills.includes('PYME_HOSP')) {
      icons.push({icon: 'domain', tooltip: 'PyME Hospitalidad', color: 'text-orange-500'});
    }
    return icons;
  }

/*  private updateChildrenSelection(node: Resource, isChecked: boolean) {
      for (const child of node.children || []) {
        child.selected = isChecked;
        this.updateChildrenSelection(child, isChecked);
      }
    }*/
}
