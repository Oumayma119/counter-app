import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { PublicHoliday } from '../models/public-holiday';
import { daysUntil, localDateIso } from '../models/holiday-date';
import { Country, HolidayApiService, SchoolHoliday } from '../services/holiday-api.service';
import { FormsModule } from '@angular/forms';

const PREF_SELECTION = 'holiday_app_selection';
const PREF_CACHE = 'holiday_app_cache';
const PREF_CUSTOM_EVENTS = 'holiday_app_custom_events';

interface CustomEvent {
  id: string;
  title: string;
  targetDate: string;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    DatePipe,
    FormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class Tab3Page implements OnInit, OnDestroy {
  private readonly holidayApi = inject(HolidayApiService);

  readonly category = signal<'public' | 'school' | 'custom'>('public');
  readonly countries = signal<Country[]>([]);
  readonly selectedCountry = signal('CZ');
  readonly holidays = signal<(PublicHoliday | SchoolHoliday)[]>([]);
  readonly selectedId = signal('');
  readonly today = signal(localDateIso());
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly isCached = signal(false);

  readonly customEvents = signal<CustomEvent[]>([]);
  newCustomTitle = '';
  newCustomDate = '';

  private midnightTimer: number | null = null;

  readonly selectedHoliday = computed(() =>
    this.holidays().find((h) => h.id === this.selectedId()),
  );

  readonly selectedCustomEvent = computed(() =>
    this.customEvents().find((e) => e.id === this.selectedId()),
  );

  readonly remainingDays = computed(() => {
    if (this.category() === 'custom') {
      const custom = this.selectedCustomEvent();
      return custom ? daysUntil(custom.targetDate, this.today()) : null;
    }
    const holiday = this.selectedHoliday();
    return holiday ? daysUntil(holiday.startDate, this.today()) : null;
  });

  async ngOnInit(): Promise<void> {
    this.scheduleMidnightUpdate();
    await this.loadSavedPreferences();
  }

  ngOnDestroy(): void {
    if (this.midnightTimer) {
      window.clearTimeout(this.midnightTimer);
    }
  }

  async ionViewWillEnter(): Promise<void> {
    this.today.set(localDateIso());
    await this.loadData();
  }

  private scheduleMidnightUpdate(): void {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    this.midnightTimer = window.setTimeout(() => {
      this.today.set(localDateIso());
      this.scheduleMidnightUpdate();
    }, msUntilMidnight);
  }

  holidayName(holiday: PublicHoliday | SchoolHoliday): string {
    return holiday.name.find((n: any) => n.language === 'CS')?.text ??
      holiday.name.find((n: any) => n.language === 'EN')?.text ??
      holiday.name[0]?.text ?? 'Svátek bez názvu';
  }

  subdivisionNames(holiday: SchoolHoliday): string {
    if (!holiday.subdivisions || holiday.subdivisions.length === 0) return '';
    return holiday.subdivisions.map((s: any) => s.shortName || s.code).join(', ');
  }

  async loadData(): Promise<void> {
    if (this.category() === 'custom') {
      return;
    }
    if (this.loading()) return;

    const todayStr = localDateIso();
    const nextYear = Number(todayStr.slice(0, 4)) + 1;
    this.today.set(todayStr);
    this.loading.set(true);
    this.errorMessage.set('');
    this.isCached.set(false);

    try {
      if (this.countries().length === 0) {
        const cList = await this.holidayApi.getCountries();
        this.countries.set(cList);
      }

      let data: (PublicHoliday | SchoolHoliday)[] = [];
      if (this.category() === 'public') {
        data = await this.holidayApi.getHolidays(this.selectedCountry(), todayStr, `${nextYear}-12-31`);
      } else {
        data = await this.holidayApi.getSchoolHolidays(this.selectedCountry(), todayStr, `${nextYear}-12-31`);
      }

      const upcoming = data.filter((h) => h.startDate >= todayStr);
      this.holidays.set(upcoming);

      if (!upcoming.some((h) => h.id === this.selectedId())) {
        this.selectedId.set(upcoming[0]?.id ?? '');
      }

      await Preferences.set({
        key: PREF_CACHE,
        value: JSON.stringify({ category: this.category(), country: this.selectedCountry(), data: upcoming }),
      });
      await this.saveSelection();
    } catch (error) {
      console.error('Failed to load online data', error);

      const cached = await Preferences.get({ key: PREF_CACHE });
      if (cached.value) {
        try {
          const parsed = JSON.parse(cached.value);
          if (parsed.data) {
            this.holidays.set(parsed.data);
            this.isCached.set(true);
            this.errorMessage.set('Jste v režimu offline. Zobrazují se uložená data.');
          }
        } catch {
          this.setErrorMessage(error);
        }
      } else {
        this.setErrorMessage(error);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private setErrorMessage(error: unknown): void {
    if (error instanceof TimeoutError) {
      this.errorMessage.set('Server neodpověděl včas. Zkuste načtení znovu.');
    } else if (error instanceof HttpErrorResponse && error.status === 0) {
      this.errorMessage.set('API není dostupné. Zkontrolujte připojení.');
    } else {
      this.errorMessage.set('Chyba při načítání dat z API.');
    }
  }

  async onSelectionChange(id: string): Promise<void> {
    this.selectedId.set(id);
    await this.saveSelection();
  }

  async onCategoryChange(cat: string | undefined): Promise<void> {
    if (!cat) return;
    const validCat = cat as 'public' | 'school' | 'custom';
    this.category.set(validCat);
    this.selectedId.set('');
    await this.saveSelection();
    if (validCat !== 'custom') {
      await this.loadData();
    }
  }

  async onCountryChange(country: string): Promise<void> {
    this.selectedCountry.set(country);
    this.selectedId.set('');
    await this.saveSelection();
    await this.loadData();
  }

  private async saveSelection(): Promise<void> {
    const selHoliday = this.selectedHoliday();
    await Preferences.set({
      key: PREF_SELECTION,
      value: JSON.stringify({
        category: this.category(),
        country: this.selectedCountry(),
        selectedId: this.selectedId(),
        targetDate: selHoliday?.startDate ?? '',
      }),
    });
  }

  private async loadSavedPreferences(): Promise<void> {
    const sel = await Preferences.get({ key: PREF_SELECTION });
    if (sel.value) {
      try {
        const p = JSON.parse(sel.value);
        if (p.category) this.category.set(p.category);
        if (p.country) this.selectedCountry.set(p.country);
        if (p.selectedId) this.selectedId.set(p.selectedId);
      } catch (e) {
        console.error(e);
      }
    }

    const cust = await Preferences.get({ key: PREF_CUSTOM_EVENTS });
    if (cust.value) {
      try {
        this.customEvents.set(JSON.parse(cust.value));
      } catch (e) {
        console.error(e);
      }
    }
  }

  async addCustomEvent(): Promise<void> {
    if (!this.newCustomTitle.trim() || !this.newCustomDate) return;

    const newEv: CustomEvent = {
      id: 'custom_' + Date.now(),
      title: this.newCustomTitle.trim(),
      targetDate: this.newCustomDate,
    };

    const updated = [...this.customEvents(), newEv];
    this.customEvents.set(updated);
    this.selectedId.set(newEv.id);
    this.newCustomTitle = '';
    this.newCustomDate = '';

    await Preferences.set({
      key: PREF_CUSTOM_EVENTS,
      value: JSON.stringify(updated),
    });
  }

  async deleteCustomEvent(id: string): Promise<void> {
    const updated = this.customEvents().filter((e) => e.id !== id);
    this.customEvents.set(updated);
    if (this.selectedId() === id) {
      this.selectedId.set(updated[0]?.id ?? '');
    }
    await Preferences.set({
      key: PREF_CUSTOM_EVENTS,
      value: JSON.stringify(updated),
    });
  }
}