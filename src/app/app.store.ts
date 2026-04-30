import { Injectable } from '@angular/core';
import {
  GetACalendarResponseFormatted,
  Resource,
  resourcesToSetWorkskills,
  workSkillItem,
  workSkills,
} from './types/ofs-rest-api';
import { ComponentStore } from '@ngrx/component-store';
import { OfsApiPluginService } from './services/ofs-api-plugin.service';
import { OfsRestApiService } from './services/ofs-rest-api.service';
import { Message } from './types/plugin-api';
import {
  EMPTY,
  concatMap,
  map,
  tap,
  switchMap, of,
  forkJoin,
  from,
} from 'rxjs';
import { DataRange } from './types/plugin';
import { DialogService } from './services/dialog.service';
import {ResourceTreeService} from "./services/resource-tree.service";
import dayjs from 'dayjs';

interface State {
  isLoading: boolean;
  selectedRange: DataRange;
  intervalDates: string[];
  validatedDates: string[];
  resourcesTreeRaw?: Resource[];
  resourcesTreeResidencial?: Resource;
  resourcesTreePyme?: Resource[];
  selectedResidential: Resource[];
  selectedPyme: Resource[];
  selectedSkillType: string;
  residentialSearchTerm: string;
  pymeSearchTerm: string;
}

const initialState: State = {
  isLoading: false,
  selectedRange: { from: null, to: null, valid: false },
  intervalDates: [],
  validatedDates: [],
  selectedResidential: [],
  selectedPyme: [],
  selectedSkillType: '',
  residentialSearchTerm: '',
  pymeSearchTerm: '',
};

@Injectable({
  providedIn: 'root',
})
export class AppStore extends ComponentStore<State> {
  constructor(
    private readonly ofsPluginApi: OfsApiPluginService,
    private readonly ofsRestApi: OfsRestApiService,
    private readonly dialogService: DialogService,
    private readonly resourceTreeService: ResourceTreeService,
  ) {
    super(initialState);
    this.handleOpenMessage(this.ofsPluginApi.openMessage$);
    this.ofsPluginApi.ready();
  }

  //View Model
  private readonly resourceTreePymeGrouped$ = this.select(
    this.select(state => state.resourcesTreePyme),
    this.select(state => state.resourcesTreeRaw),
    (resourcesTreePyme, allResources) => {
      if (!resourcesTreePyme || resourcesTreePyme.length === 0 || !allResources) {
        return null;
      }
      return this.resourceTreeService.groupForestByParentId(resourcesTreePyme, allResources, 'Nodo virtual Izzi')
    }
  );
  public readonly vm$ = this.select(this.state$, this.resourceTreePymeGrouped$, (state, resourceTreePymeGrouped) => ({
    ...state,
    resourcesTreePyme: resourceTreePymeGrouped,
  }))

  // Updaters
  readonly setSelectedRange = this.updater<DataRange>(
    (state, selectedRange) => ({ ...state, selectedRange })
  );
  readonly setIsLoading = this.updater<boolean>((state, isLoading) => ({
    ...state,
    isLoading,
  }));
  readonly setResourcesTreeResidencial = this.updater<Resource>((state, resourcesTreeResidencial) => ({
    ...state,
    resourcesTreeResidencial,
  }));
  readonly setResourcesTreePyme = this.updater<Resource[]>((state, resourcesTreePyme) => ({
    ...state,
    resourcesTreePyme,
  }));
  readonly setResourcesTreeRaw = this.updater<Resource[]>((state, resourcesTreeRaw) => ({
    ...state,
    resourcesTreeRaw
  }));
  readonly toggleResidentialSelection = this.updater((state, {resource, isSelected}: {resource: Resource, isSelected: boolean}) => {
    let updatedSelectedResources: Resource[];

    if (isSelected) {
      const exists = state.selectedResidential.some(r => r.resourceId === resource.resourceId);
      if (!exists) {
        updatedSelectedResources = [...state.selectedResidential, resource];
      } else {
        updatedSelectedResources = state.selectedResidential;
      }
    } else {
      updatedSelectedResources = state.selectedResidential.filter(r => r.resourceId !== resource.resourceId)
    }
    return {
      ...state,
      selectedResidential: updatedSelectedResources
    }
  });
  readonly togglePymeSelection = this.updater((state, {resource, isSelected}: {resource: Resource, isSelected: boolean}) => {
    let updatedSelectedResources: Resource[];

    if (isSelected) {
      const exists = state.selectedPyme.some(r => r.resourceId === resource.resourceId);
      if (!exists) {
        updatedSelectedResources = [...state.selectedPyme, resource];
      } else {
        updatedSelectedResources = state.selectedPyme;
      }
    } else {
      updatedSelectedResources = state.selectedPyme.filter(r => r.resourceId !== resource.resourceId)
    }
    return {
      ...state,
      selectedPyme: updatedSelectedResources
    }
  });
  readonly setSelectedSkillType = this.updater<string>((state, selectedSkillType) => ({
    ...state,
    selectedSkillType
  }));
  readonly setResidentialSearchTerm = this.updater<string>((state, residentialSearchTerm) => ({
    ...state,
    residentialSearchTerm,
  }));
  readonly setPymeSearchTerm = this.updater<string>((state, pymeSearchTerm) => ({
    ...state,
    pymeSearchTerm,
  }));

  // Effects
  private readonly handleOpenMessage = this.effect<Message>(($) =>
    $.pipe(
      tap(() => this.setIsLoading(true)),
      map(({ securedData, user }) => {
        const { ofscRestClientId, ofscRestSecretId, urlOFSC, usersOfsc } = securedData;
        const { ulogin } = user;
        if (!ofscRestClientId || !ofscRestClientId || !urlOFSC) {
          throw new Error(
            'Los campos url, user y pass son requeridos para el correcto funcionamiento del plugin'
          );
        }
        const validLogin = this.login(ulogin, usersOfsc);
        if (validLogin) {
          this.ofsRestApi
            .setUrl(urlOFSC)
            .setCredentials({ user: ofscRestClientId, pass: ofscRestSecretId });
        } else {
          this.dialogService.invalid("Usuario sin permisos para acceder al plugin");
          EMPTY;
        }
      }),
      concatMap(async () => this.getResourcesTreeRaw()),
      concatMap(() => this.ofsRestApi.getAllResources()),
      tap((resourcesTreeRaw) => this.setResourcesTreeRaw(resourcesTreeRaw)),
      concatMap((resourcesTreeRaw) => resourcesTreeRaw && this.handleResourcesTree(resourcesTreeRaw)),
      tap(() => this.setIsLoading(false))
    )
  );

  private readonly getResourcesTreeRaw = this.effect(($) =>
    $.pipe(
      concatMap(() => this.ofsRestApi.getAllResources()),
      concatMap((resourcesTreeRaw) => resourcesTreeRaw && this.handleResourcesTree(resourcesTreeRaw)),
      tap(() => Promise.resolve())
    )
  );

  private readonly residentialToPyme = this.effect(($) => $.pipe(
    tap(() => this.setIsLoading(true)),
    tap(() => console.log(this.get().selectedResidential)),
    map(() => this.handleWorkSkillsToPyme(this.get().selectedResidential)),
    tap((resourcesToSetWorkSkills) => console.log(resourcesToSetWorkSkills)),
    concatMap((resourcesData) => {
      if (resourcesData.length === 0) return of(null);
      // Procesamos todos los recursos seleccionados, no solo el primero
      return forkJoin(resourcesData.map(res => this.ofsRestApi.setWorkSkills(res)));
    }),
    switchMap((result) => result ? this.calendarResource(true) : of(false)),
    tap((success) => success && this.dialogService.success(
      `Recursos movidos exitosamente a PYME : ${this.get().selectedResidential.length}`
    )),
    tap(() => this.clearBuffer()),
    /*tap(() => this.getResourcesTreeRaw()),*/
    concatMap(() => this.ofsRestApi.getAllResources()),
    concatMap((resourcesTreeRaw) => resourcesTreeRaw && this.handleResourcesTree(resourcesTreeRaw)),
    tap(() => this.setIsLoading(false)),
  ));

  private readonly pymeToResidential = this.effect(($) => $.pipe(
    tap(() => this.setIsLoading(true)),
    map(() => this.handleWorkSkillsToResidential(this.get().selectedPyme)),
    concatMap((resourcesData) => {
      if (!resourcesData || resourcesData.length === 0) return of(null);
      return forkJoin(resourcesData.map(res => this.ofsRestApi.setWorkSkills(res)));
    }),
    switchMap((result) => result ? this.calendarResource(false) : of(false)),
    tap(() => this.dialogService.success(`Recursos movidos exitosamente a Residencial : ${this.get().selectedPyme.length}`)),
    tap(() => this.clearBuffer()),
    concatMap(() => this.ofsRestApi.getAllResources()),
    concatMap((resourcesTreeRaw) => resourcesTreeRaw && this.handleResourcesTree(resourcesTreeRaw)),
    tap(() => this.setIsLoading(false)),
  ));

  public sendCloseMessage = this.effect<Partial<Message>>((data$) =>
    data$.pipe(tap((data) => this.ofsPluginApi.close(data)))
  );

  // Actions
  private login(ulogin: string, usersOfsc: string): boolean {
    const validUsers = usersOfsc.trim().split(";");
    const valid = validUsers.find(user => user === ulogin);
    return !!valid;
  }

  private handleResourcesTree(resourcesTreeRaw: Resource[]) {
    const cleanResourcesTreeRaw = resourcesTreeRaw.filter((resource) =>
      resource.status === 'active' && resource.organization === 'default');
    const pymeTree = cleanResourcesTreeRaw.filter((resource) =>
      resource.workSkills?.items &&
      resource.workSkills?.items?.some(skill => ['PYME','PYME_HOSP'].includes(skill.workSkill) && dayjs(skill.endDate)>=dayjs()));
    const idsPyme = new Set(pymeTree.map(r => r.resourceId));
    const residencial = cleanResourcesTreeRaw.filter(resource => !idsPyme.has(resource.resourceId));
    const residencialTree = this.resourceTreeService.buildTree(residencial);
    const pymeForest = this.resourceTreeService.buildForest(pymeTree);
    residencialTree && this.setResourcesTreeResidencial(residencialTree!);
    pymeTree && this.setResourcesTreePyme(pymeForest);
    return Promise.resolve(residencialTree);
  };

  public confirmMovement(pyme: boolean) {
    pyme ?
      this.dialogService.confirm(`¿Seguro que deseas mover ${this.get().selectedResidential.length} ${this.get().selectedResidential.length > 1 ? 'recursos' : 'recurso'} a PYME?`).subscribe(result => result! && this.residentialToPyme())
      :
      this.dialogService.confirm(`¿Seguro que deseas mover ${this.get().selectedPyme.length} ${this.get().selectedPyme.length > 1 ? 'recursos' : 'recurso'} a Residencial?`).subscribe(result => result! && this.pymeToResidential());
  }

  private handleWorkSkillsToPyme(selectedResources: Resource[]): resourcesToSetWorkskills[] {
    const {selectedRange, selectedSkillType} = this.get();
    const oneDayAfter = dayjs(selectedRange.to).add(1, 'day').format("YYYY-MM-DD");
    return selectedResources.map(resource => {
      const workSkills: workSkills[] = [];

      // Si tiene habilidades previas, las mantenemos para después del rango seleccionado
      if (resource.workSkills?.items) {
        const skillsMap = new Map<string, workSkillItem>();
        resource.workSkills.items.forEach(skill => !['PYME', 'PYME_HOSP'].includes(skill.workSkill) && skillsMap.set(skill.workSkill, skill));

        workSkills.push(...Array.from(skillsMap.values()).map(item => ({
          workSkill: item.workSkill,
          ratio: item.ratio,
          startDate: oneDayAfter
        })));
      }

      workSkills.push({
        workSkill: selectedSkillType.toUpperCase(),
        ratio: 100,
        startDate: selectedRange.from!,
        endDate: selectedRange.to!
      });

      return {
        resourceId: resource.resourceId,
        workSkills: workSkills
      };
    });
  }

  private handleWorkSkillsToResidential(selectedResources: Resource[]): resourcesToSetWorkskills[] {
    const today = dayjs();

    return selectedResources.map(resource => {
      const skillsMap = new Map<string, workSkillItem>();
      
      if (resource.workSkills?.items) {
        resource.workSkills.items.forEach(skill => 
          !['PYME','PYME_HOSP'].includes(skill.workSkill) && skillsMap.set(skill.workSkill, skill)
        );
      }

      const workSkills: workSkills[] = Array.from(skillsMap.values()).map(item => ({
        workSkill: item.workSkill,
        ratio: item.ratio,
        startDate: today.format('YYYY-MM-DD')
      }));

      const resourceData: resourcesToSetWorkskills = {
        resourceId: resource.resourceId,
        workSkills: workSkills
      };

      return resourceData;
    });
  }

  private calendarResource(toPyme: boolean) {
    const { selectedRange, selectedSkillType } = this.get();
    const today = dayjs();
    
    if (toPyme) {
      const {selectedResidential} = this.get();
      if (selectedResidential.length === 0) return of(true);

      const tasks = selectedResidential.map(resource => 
        this.ofsRestApi.getACalendar(resource.resourceId, {dateFrom: selectedRange.from!, dateTo: selectedRange.to!}).pipe(
          switchMap(calendar => {
            if (!calendar) return of(null);
            const dates = Object.entries(calendar).flatMap(([date, cat]) => 
              Object.values(cat).map(d => ({ date, ...d as any }))
            ).filter(d => d.recordType === "non-working");

            if (dates.length === 0) return of(null);

            const schedules = dates.map(d => {
              const shiftLabel = selectedSkillType === "PYME_HOSP" ? "Hospitalidad_09_18" : "09:00-16:00";
              return this.ofsRestApi.setAWorkSchedule(resource.resourceId, {
                startDate: d.date,
                endDate: d.date,
                comments: "Operaciones PyME API",
                isWorking: true,
                shiftLabel,
                recordType: "extra_shift",
                recurrence: { recurrenceType: "daily", recurEvery: 1 }
              });
            });
            return forkJoin(schedules);
          })
        )
      );
      return forkJoin(tasks).pipe(map(() => true));
    } else {
      const {selectedPyme} = this.get();
      if (selectedPyme.length === 0) return of(true);

      const daysInFuture = today.add(5, 'days').format("YYYY-MM-DD");
      const tasks = selectedPyme.map(resource => 
        this.ofsRestApi.getACalendar(resource.resourceId, {dateFrom: today.format("YYYY-MM-DD"), dateTo: daysInFuture}).pipe(
          switchMap(calendar => {
            if (!calendar) return of(null);
            const dates = Object.entries(calendar).flatMap(([date, cat]) => 
              Object.values(cat).map(d => ({ date, ...d as any }))
            ).filter(d => d.comments?.includes("Operaciones PyME") && d.shiftLabel === "09:00-16:00");

            if (dates.length === 0) return of(null);

            const schedules = dates.map(d => this.ofsRestApi.setAWorkSchedule(resource.resourceId, {
                startDate: d.date,
                endDate: d.date,
                comments: "Retorno Residencial API",
                isWorking: false,
                recordType: "non-working",
                shiftType: "regular",
                nonWorkingReason: "DÍA_LIBRE",
                recurrence: { recurrenceType: "daily", recurEvery: 1 }
              })
            );
            return forkJoin(schedules);
          })
        )
      );
      return forkJoin(tasks).pipe(map(() => true));
    }
  }

  private clearBuffer() {
    this.patchState({
      selectedResidential: [],
      selectedPyme: [],
      resourcesTreeResidencial: undefined,
      resourcesTreePyme: undefined,
      selectedSkillType: '',
      residentialSearchTerm: '',
      pymeSearchTerm: ''
    });
    this.setSelectedRange({from: null, to: null, valid: false});
  }

  private handleError(err: Error) {
    console.log('Error', err);
    alert('Hubo un error\n' + err.message || 'Error desconocido');
    return EMPTY;
  }
}
