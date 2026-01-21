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
  resourcesTreeResidencial?: Resource;
  resourcesTreePyme?: Resource[];
  selectedResidential: Resource[];
  selectedPyme: Resource[];
  selectedSkillType: string;
}

const initialState: State = {
  isLoading: false,
  selectedRange: { from: null, to: null, valid: false },
  intervalDates: [],
  validatedDates: [],
  selectedResidential: [],
  selectedPyme: [],
  selectedSkillType: 'PYME'
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

  // Selectors
  private readonly isLoading$ = this.select((state) => state.isLoading);

  //View Model
  public readonly vm$ = this.select((state) => state)

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
    map(() => this.handleWorkSkillsToPyme(this.get().selectedResidential)),
    concatMap((resource) => this.ofsRestApi.setWorkSkills(resource[0])),
    switchMap(() => this.calendarResource(true)),
    tap(() => this.dialogService.success(`Recursos movidos exitosamente a PYME : ${this.get().selectedResidential.length}`)),
    tap(() => this.clearBuffer()),
    /*tap(() => this.getResourcesTreeRaw()),*/
    concatMap(() => this.ofsRestApi.getAllResources()),
    concatMap((resourcesTreeRaw) => resourcesTreeRaw && this.handleResourcesTree(resourcesTreeRaw)),
    tap(() => this.setIsLoading(false)),
  ));

  private readonly pymeToResidential = this.effect(($) => $.pipe(
    tap(() => this.setIsLoading(true)),
    map(() => this.handleWorkSkillsToResidential(this.get().selectedPyme)),
    switchMap(resources => {
      const hasInvalidResource = resources.some(resource => resource.workSkills.length === 0);
      if (hasInvalidResource) {
        this.dialogService.error(`Error: Un recurso seleccionado no cuenta con habilidades para restaurar.`);
        this.setIsLoading(false);
        this.clearBuffer();
        this.getResourcesTreeRaw();
        return EMPTY;
      }
      else {
        return of(resources);
      }
    }),
    concatMap((resource) => this.ofsRestApi.setWorkSkills(resource[0])),
    switchMap(() => this.calendarResource(false)),
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
    console.log(cleanResourcesTreeRaw.find(resource => resource.resourceId === 'RMJ98191'));
    const pymeTree = cleanResourcesTreeRaw.filter((resource) =>
      resource.workSkills?.items &&
      resource.workSkills?.items?.some(skill => ['PYME','PYME_HOSP'].includes(skill.workSkill) && dayjs(skill.endDate)>=dayjs()));
    const idsPyme = new Set(pymeTree.map(r => r.resourceId));
    const residencial = cleanResourcesTreeRaw.filter(resource => !idsPyme.has(resource.resourceId));
    const residencialTree = this.resourceTreeService.buildTree(residencial);
    residencialTree && this.setResourcesTreeResidencial(residencialTree!);
    pymeTree && this.setResourcesTreePyme(pymeTree!);
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
      if (!resource.workSkills?.items || resource.workSkills.items.length === 0) {
        return {
          resourceId: resource.resourceId,
          workSkills: []
        }
      }

      const skillsMap = new Map<string, workSkillItem>();

      resource.workSkills.items.forEach(skill => !skill.endDate && skillsMap.set(skill.workSkill, skill));

      const workSkills: workSkills[] = Array.from(skillsMap.values()).map(item => ({
        workSkill: item.workSkill,
        ratio: item.ratio,
        startDate: oneDayAfter
      }));

      workSkills.push({
        workSkill: selectedSkillType.toUpperCase(),
        ratio: 100,
        startDate: selectedRange.from!,
        endDate: selectedRange.to!
      });

      const resourceData: resourcesToSetWorkskills = {
        resourceId: resource.resourceId,
        workSkills: workSkills
      };
      return resourceData;
    }).filter(resourceData => resourceData.workSkills.length > 0);
  }

  private handleWorkSkillsToResidential(selectedResources: Resource[]): resourcesToSetWorkskills[] {
    const today = dayjs();

    return selectedResources.map(resource => {
      if (!resource.workSkills?.items || resource.workSkills.items.length === 0) {
        return {
          resourceId: resource.resourceId,
          workSkills: []
        }
    }

      const skillsMap = new Map<string, workSkillItem>();
      resource.workSkills.items.forEach(skill => !['PYME','PYME_HOSP'].includes(skill.workSkill) && skillsMap.set(skill.workSkill, skill));

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
    const { selectedRange } = this.get();
    const today = dayjs();
    if (toPyme) {
      const {selectedResidential} = this.get();
      selectedResidential.map(resource => {
        this.ofsRestApi.getACalendar(resource.resourceId, {dateFrom: selectedRange.from!, dateTo: selectedRange.to!}).subscribe(calendarResource => {
          if (calendarResource) {
            const calendarResourceArray: GetACalendarResponseFormatted[] = Object.entries(calendarResource).flatMap(([date, categorie]) => {
              return Object.values(categorie).map(details => {
                return {
                  date: date,
                  ...(details as object)
                }
              })
            });
            calendarResourceArray.map(({date, recordType}) => {
              if (recordType === "non-working") {
                this.ofsRestApi.
                  setAWorkSchedule(resource.resourceId, {
                    startDate: date,
                    endDate: date,
                    comments: "Operaciones PyME API",
                    isWorking: true,
                    shiftLabel: "09:00-16:00",
                    recordType: "extra_shift",
                    recurrence: {
                      recurrenceType: "daily",
                      recurEvery: 1
                    }
                })
                  .subscribe(response => {
                    if (response) {
                      return Promise.resolve();
                    } else {
                      throw new Error(
                        'Hubo un error al establecer el horario de trabajo del recurso'
                      );
                    }
                })
              }
            });
          }
        })
      });
    } else {
      const {selectedPyme} = this.get();
      const daysInFuture = today.add(5, 'days').format("YYYY-MM-DD");
      selectedPyme.map(resource => {
        this.ofsRestApi.getACalendar(resource.resourceId, {dateFrom: today.format("YYYY-MM-DD"), dateTo: daysInFuture}).subscribe(calendarResource => {
          if (calendarResource) {
            const calendarResourceArray: GetACalendarResponseFormatted[] = Object.entries(calendarResource).flatMap(([date, categorie]) => {
              return Object.values(categorie).map(details => {
                return {
                  date: date,
                  ...(details as object)
                }
              })
            });
            calendarResourceArray.map(({date, recordType, shiftLabel, comments}) => {
              if (comments?.includes("Operaciones PyME") && shiftLabel === "09:00-16:00") {
                this.ofsRestApi.setAWorkSchedule(resource.resourceId, {
                  startDate: date,
                  endDate: date,
                  comments: "Retorno Residencial API",
                  isWorking: false,
                  recordType: "non-working",
                  shiftType: "regular",
                  nonWorkingReason: "DÍA_LIBRE",
                  recurrence: {
                    recurrenceType: "daily",
                    recurEvery: 1
                  }
                }).subscribe(response => {
                  if (response) {
                    return Promise.resolve();
                  } else {
                    throw new Error('Hubo un error al establecer el horario de trabajo del recurso de Residencial a PyME')
                    }
                  }
                )
              }
            });
          }
        })
      });
    }
    return of(true);
  }

  private clearBuffer() {
    this.patchState({selectedResidential: []});
    this.patchState({selectedPyme: []});
    this.patchState({resourcesTreeResidencial: undefined});
    this.patchState(({resourcesTreePyme: undefined}));
    this.setSelectedRange({from: null, to: null, valid: false});
  }

  private handleError(err: Error) {
    console.log('Error', err);
    alert('Hubo un error\n' + err.message || 'Error desconocido');
    return EMPTY;
  }
}
