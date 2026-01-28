import { Injectable } from '@angular/core';
import {Resource} from "../types/ofs-rest-api";

@Injectable({
  providedIn: 'root'
})
export class ResourceTreeService {
  constructor() {}

  buildTree(resources: Resource[]): Resource | null {
    const map = new Map<string, Resource>();
    let root: Resource | null = null;

    resources.forEach(resource => {
      map.set(resource.resourceId, { ...resource, children: [] });
    });

    resources.forEach(resource => {
      if (resource.parentResourceId) {
        const parent = map.get(resource.parentResourceId);
        if (parent) {
          parent.children!.push(map.get(resource.resourceId)!);
        }
      } else {
        root = map.get(resource.resourceId) || null;
      }
    });

    return root;
  }

  buildForest(resources: Resource[]): Resource[] {
    const map = new Map<string, Resource>();
    const roots: Resource[] = [];

    resources.forEach(resource => {
      map.set(resource.resourceId, { ...resource, children: [] });
    });

    resources.forEach(resource => {
      const node = map.get(resource.resourceId)!;
      if (resource.parentResourceId) {
        const parent = map.get(resource.parentResourceId);
        if (parent) {
          parent.children!.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  groupForestUnderVirtualRoot(forest: Resource[], rootName: string = 'Recursos agrupados'): Resource {
    return {
      resourceId: 'virtual-root-node',
      organization: 'default',
      status: 'active',
      name: rootName,
      children: forest,
      resourceType: 'GR'
    }
  }

  groupForestByParentId(forest: Resource[], allResources: Resource[], rootName: string = 'Recursos agrupados'): Resource | null{
    if (!forest || forest.length === 0) {
      return null;
    }
    const parentNameLookup = new Map<string, string>();
    allResources.forEach(resource => {
      parentNameLookup.set(resource.resourceId, resource.name);
    });

    const groups = new Map<string, Resource[]>();

    forest.forEach(resource => {
      const parentId = resource.parentResourceId || 'Sin agrupar';
      if (!groups.has(parentId)) {
        groups.set(parentId, [])
      }
      groups.get(parentId)!.push(resource);
    });

    const categoryNodes: Resource[] = [];
    groups.forEach((children, parentId) => {
      const categoryName = parentNameLookup.get(parentId) || parentId;
      const categoryNode: Resource = {
        resourceId: parentId,
        organization: 'default',
        status: 'active',
        name: categoryName,
        children: children,
        resourceType: 'BK'
      };
      categoryNodes.push(categoryNode);
    });
    return this.groupForestUnderVirtualRoot(categoryNodes, rootName)
  }
}
